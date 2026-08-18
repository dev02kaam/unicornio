const id = '008-persistent-abuse-controls';

const sql = `
  create table if not exists unicornio_abuse_counters (
    namespace text not null check (char_length(namespace) between 1 and 80),
    key_hash text not null check (char_length(key_hash) = 64),
    hits integer not null check (hits >= 0),
    reset_at timestamptz not null,
    primary key (namespace, key_hash)
  );
  create index if not exists unicornio_abuse_counters_expiry_idx
    on unicornio_abuse_counters (reset_at);
`;

module.exports = { id, sql };
