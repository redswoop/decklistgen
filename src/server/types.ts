import type { User } from "../shared/types/user.js";

export type AppEnv = {
  Variables: {
    user: User | null;
  };
};
