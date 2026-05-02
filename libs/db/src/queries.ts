import { db } from "./client";
import { sql } from "drizzle-orm";

export const getCurrentTime = async () => {
    const rawSelectResult = await db.execute(sql`SELECT NOW() as current_time`);
    return rawSelectResult.rows[0].current_time;
}

// Re-export all query modules
export * from "./queries/subAgency";
export * from "./queries/agencyUser";
export * from "./queries/invitation";
export * from "./queries/apiKey";
export * from "./queries/users";
export * from "./queries/emailAccount";
export * from "./queries/emailQueue";
export * from "./queries/emailCampaign";
export * from "./queries/emailEvent";
export * from "./queries/emailTemplate";
export * from "./queries/emailUnsubscribe";
export * from "./queries/replyFollowup";