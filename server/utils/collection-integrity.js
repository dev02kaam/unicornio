function repairLegalTextVersions(items = []) {
  const seenIds = new Map();
  const seenVersions = new Map();
  const repairedReversed = [];
  const removed = [];
  const idReplacements = new Map();

  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    const id = String(item?.id || '').trim();
    const version = String(item?.version || '').trim();
    const duplicate = seenIds.get(id) || seenVersions.get(version);

    if ((id && seenIds.has(id)) || (version && seenVersions.has(version))) {
      removed.push(item);
      if (id && duplicate?.id && id !== duplicate.id) {
        idReplacements.set(id, duplicate.id);
      }
      continue;
    }

    repairedReversed.push(item);
    if (id) seenIds.set(id, item);
    if (version) seenVersions.set(version, item);
  }

  return {
    items: repairedReversed.reverse(),
    removed,
    idReplacements,
  };
}

function getMaximumPrefixedSequence(items = [], prefix) {
  const escapedPrefix = String(prefix || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escapedPrefix}-(\\d+)$`);

  return items.reduce((maximum, item) => {
    const match = String(item?.id || '').match(pattern);
    return match ? Math.max(maximum, Number(match[1])) : maximum;
  }, 0);
}

module.exports = {
  getMaximumPrefixedSequence,
  repairLegalTextVersions,
};
