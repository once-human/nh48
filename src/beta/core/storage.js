// /beta keeps its own saves, settings and first-run flags: every key the game reads or writes in the browser's
// storage is filed under "beta:" here, so playing /beta never touches the game's own save on the same site.
for (const S of [globalThis.Storage && Storage.prototype].filter(Boolean)) {
  const get = S.getItem, set = S.setItem, del = S.removeItem;
  S.getItem = function (k) { return get.call(this, 'beta:' + k); };
  S.setItem = function (k, v) { return set.call(this, 'beta:' + k, v); };
  S.removeItem = function (k) { return del.call(this, 'beta:' + k); };
}
