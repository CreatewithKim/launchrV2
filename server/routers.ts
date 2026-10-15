import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { launchrRouter } from "./routers/launchr";
import { getConfiguredAuthOptions } from "./auth";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    providers: publicProcedure.query(() => {
      const options = getConfiguredAuthOptions();
      return {
        emailAndPassword: options.emailPassword,
        social: {
          google: options.google,
          github: options.github,
        },
      };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      ctx.res.clearCookie("better-auth.session_token", { path: "/" });
      ctx.res.clearCookie("better-auth.session_data", { path: "/" });
      return { success: true } as const;
    }),
  }),
  launchr: launchrRouter,
});

export type AppRouter = typeof appRouter;
