import { logger } from "../../shared/logger";
import { errors } from "./errors";

const requiredEnvs = ["NODE_ENV", "PORT"] as const;
export type Env = (typeof requiredEnvs)[number];

const missing = requiredEnvs.filter((e) => !(e in process.env));
if (missing.length > 0) {
    logger.error(errors.MISSING_ENV + ": " + missing.join(", "));
    process.exit(1);
}

type Envs = {
    [env in Env]: string;
};

export const envs: Envs = process.env as never;
