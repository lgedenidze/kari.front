/**
 * Opens a path on this site as a whole new page, instead of moving inside the app.
 *
 * The app holds things for whoever is signed in: screens fetched ahead of a tap, and each
 * screen's last answer. A full load throws all of it away. That is the point wherever the
 * account changes — after signing in, and when a session has ended.
 */
export function openFresh(path: string): void {
  window.location.assign(path);
}
