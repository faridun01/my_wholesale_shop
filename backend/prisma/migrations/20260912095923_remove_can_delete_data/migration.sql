-- Remove the unused "can_delete_data" permission flag: it was never checked by
-- any route (dead authorization field), and the user has confirmed it is not needed.
ALTER TABLE "users" DROP COLUMN "can_delete_data";
