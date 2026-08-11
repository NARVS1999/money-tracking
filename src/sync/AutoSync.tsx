// AutoSync — background sync on app foreground (SYNC-06) plus one initial
// sync shortly after mount (OFFL-06: pending changes get pushed when the app
// starts). Listens to AppState transitions; when the app returns to
// "active" it runs a full push+pull through both providers' sync() (which
// reload UI state from SQLite). Failures are swallowed on purpose — the
// syncQueue persists in SQLite and the manual Sync button / next foreground
// transition retries (OFFL-10). Must be rendered inside both EntriesProvider
// and CategoriesProvider (App.tsx).
import { useEffect } from "react";
import { AppState } from "react-native";
import { useAuth } from "../auth/AuthProvider";
import { useEntries } from "../entries/EntriesProvider";
import { useCategories } from "../categories/CategoriesProvider";

export default function AutoSync() {
  const { user } = useAuth();
  const { sync: entriesSync } = useEntries();
  const { sync: categoriesSync } = useCategories();

  useEffect(() => {
    const runSync = () => {
      if (!user) return;
      // fullSync coalesces concurrent calls into one push+pull run, so
      // calling both providers is cheap and race-free.
      Promise.allSettled([entriesSync(), categoriesSync()]).then((results) => {
        if (results.some((r) => r.status === "rejected")) {
          console.warn(
            "[sync] auto-sync failed — will retry on next foreground",
          );
        }
      });
    };

    // Initial sync shortly after mount (no AppState change fires on launch —
    // the app starts in "active"), so changes made while the app was already
    // open still get pushed on the next launch.
    const initial = setTimeout(runSync, 1500);

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") runSync();
    });

    return () => {
      clearTimeout(initial);
      sub.remove();
    };
  }, [user, entriesSync, categoriesSync]);

  return null;
}
