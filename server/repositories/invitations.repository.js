const { database } = require('../config/database');

async function createInvitation(data) {
  return database.transaction(async (client) => {
    const scope = await client.query(
      `select actor.id as actor_id, actor.role as actor_role,
              center.id as center_id, target_group.id as group_id,
              student.id as student_id
       from unicornio_users actor
       left join unicornio_centers center
         on center.id::text = $2 or center.public_id::text = $2 or center.legacy_id = $2
       left join unicornio_groups target_group
         on target_group.id::text = $3 or target_group.public_id::text = $3 or target_group.legacy_id = $3
       left join unicornio_users student
         on student.id::text = $4 or student.public_id::text = $4 or student.legacy_id = $4
       where (actor.id::text = $1 or actor.public_id::text = $1 or actor.legacy_id = $1)
         and actor.status = 'ACTIVE'`,
      [
        String(data.invitedByUserId),
        String(data.centerId || ''),
        String(data.groupId || ''),
        String(data.studentUserId || ''),
      ],
    );
    const target = scope.rows[0];
    if (!target) return null;

    if (data.role === 'STUDENT' && (!target.center_id || !target.group_id)) return null;
    if (data.role === 'STUDENT') {
      const groupScope = await client.query(
        'select 1 from unicornio_groups where id = $1 and center_id = $2 and status = \'ACTIVE\'',
        [target.group_id, target.center_id],
      );
      if (groupScope.rowCount !== 1) return null;
    }
    if (data.role === 'FAMILY' && !target.student_id) return null;

    if (target.actor_role !== 'ADMIN') {
      const requestedCenterId = data.role === 'STUDENT'
        ? target.center_id
        : (await client.query(
          `select g.center_id
           from unicornio_group_assignments ga
           join unicornio_groups g on g.id = ga.group_id
           where ga.user_id = $1 and ga.role = 'STUDENT' and ga.active_until is null
           limit 1`,
          [target.student_id],
        )).rows[0]?.center_id;
      const assignment = requestedCenterId && await client.query(
        `select 1 from unicornio_center_assignments
         where user_id = $1 and center_id = $2 and role = 'CENTER_MANAGER'
           and active_until is null`,
        [target.actor_id, requestedCenterId],
      );
      if (!assignment || assignment.rowCount !== 1) return null;
    }

    const result = await client.query(
      `insert into unicornio_invitations (
         token_hash, email, role, center_id, group_id, student_user_id,
         invited_by_user_id, expires_at
       ) values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning id, expires_at`,
      [
        data.tokenHash,
        data.email,
        data.role,
        target.center_id || null,
        target.group_id || null,
        target.student_id || null,
        target.actor_id,
        data.expiresAt,
      ],
    );
    return result.rows[0];
  });
}

async function consumeInvitation(data) {
  return database.transaction(async (client) => {
    const invitationResult = await client.query(
      `select * from unicornio_invitations
       where token_hash = $1
         and used_at is null
         and revoked_at is null
         and expires_at > $2
       for update`,
      [data.tokenHash, data.now],
    );
    const invitation = invitationResult.rows[0];
    if (!invitation) return null;

    const userResult = await client.query(
      `insert into unicornio_users (email, name, password_hash, role, status)
       values ($1, $2, $3, $4, 'ACTIVE')
       returning id, public_id, email, name, role, status`,
      [invitation.email, data.name, data.passwordHash, invitation.role],
    );
    const user = userResult.rows[0];

    if (invitation.role === 'STUDENT') {
      if (invitation.center_id) {
        await client.query(
          `insert into unicornio_center_assignments (user_id, center_id, role, is_primary)
           values ($1, $2, 'STUDENT', true)`,
          [user.id, invitation.center_id],
        );
      }
      if (invitation.group_id) {
        await client.query(
          `insert into unicornio_group_assignments (user_id, group_id, role, is_primary)
           values ($1, $2, 'STUDENT', true)`,
          [user.id, invitation.group_id],
        );
      }
    } else if (invitation.role === 'FAMILY') {
      await client.query(
        `insert into unicornio_family_links (family_user_id, student_user_id)
         values ($1, $2)`,
        [user.id, invitation.student_user_id],
      );
    }

    await client.query(
      `update unicornio_invitations
       set used_at = $2, used_by_user_id = $3
       where id = $1`,
      [invitation.id, data.now, user.id],
    );
    await client.query(
      `insert into unicornio_audit_events (
         actor_user_id, action, entity_type, entity_public_id, outcome, metadata
       ) values ($1, 'INVITATION_ACCEPTED', 'USER', $2, 'SUCCESS', $3::jsonb)`,
      [user.id, user.public_id, JSON.stringify({ invitationId: invitation.id, role: user.role })],
    );

    return {
      internalId: user.id,
      id: user.public_id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.status === 'ACTIVE',
    };
  });
}

module.exports = { createInvitation, consumeInvitation };
