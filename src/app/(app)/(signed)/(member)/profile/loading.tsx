import { ProfileScreen } from "./profile-screen";

// The profile is drawn from the account the app already holds. There is nothing to wait
// for, so there is no placeholder: the screen itself is shown from the tap.
export default function Loading() {
  return <ProfileScreen />;
}
