/**
 * Node half of dsh-exec-feed-copy — a no-op host plugin.
 *
 * All behavior lives in ./client.js (browser side). This shim only satisfies
 * the loader row contract ({ apply, inject }) so the bundle mounts cleanly in
 * the host plane and its client half is served into the browser.
 */
export const inject = [];

export async function apply() {
  // Nothing to do on the host side.
}
