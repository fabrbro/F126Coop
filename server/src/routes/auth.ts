import { Router } from "express";
import { randomUUID } from "node:crypto";
import { prisma } from "../db.js";
import {
  discordConfigured,
  discordAuthUrl,
  exchangeCode,
  fetchDiscordUser,
  isAdminId,
  signToken,
  publicUser,
  COOKIE,
  STATE_COOKIE,
  cookieSecure,
  type AuthedRequest,
} from "../auth.js";

export const authRouter = Router();

// Whether Discord login is available (so the UI can show/hide the button).
authRouter.get("/auth/status", (_req, res) => {
  res.json({
    enabled: discordConfigured(),
    // Non-sensitive diagnostics (booleans only; redirect URI is a public URL).
    config: {
      clientId: Boolean(process.env.DISCORD_CLIENT_ID),
      clientSecret: Boolean(process.env.DISCORD_CLIENT_SECRET),
      redirectUri: process.env.DISCORD_REDIRECT_URI || null,
      jwtSecret: Boolean(process.env.JWT_SECRET),
      nodeEnv: process.env.NODE_ENV || null,
    },
  });
});

// Kick off the OAuth flow.
authRouter.get("/auth/discord", (req, res) => {
  if (!discordConfigured()) {
    return res.status(503).send("Discord login is not configured on this server.");
  }
  const state = randomUUID();
  res.cookie(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure,
    maxAge: 10 * 60 * 1000,
  });
  res.redirect(discordAuthUrl(state));
});

// OAuth callback: verify state, exchange code, upsert the user, set session.
authRouter.get("/auth/discord/callback", async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code || !state || state !== req.cookies?.[STATE_COOKIE]) {
      return res.redirect("/?login=failed");
    }
    const { access_token } = await exchangeCode(String(code));
    const du = await fetchDiscordUser(access_token);

    const fields = {
      username: du.username,
      globalName: du.global_name ?? null,
      avatar: du.avatar ?? null,
      isAdmin: isAdminId(du.id),
    };
    const user = await prisma.user.upsert({
      where: { discordId: du.id },
      update: fields,
      create: { discordId: du.id, ...fields },
    });

    const sessionToken = signToken(user.id);
    console.log(
      `[auth] setting session cookie "${COOKIE}" for user ${user.id} (httpOnly: true, secure: ${cookieSecure}, sameSite: strict)`
    );
    res.cookie(COOKIE, sessionToken, {
      httpOnly: true,
      sameSite: "strict",
      secure: cookieSecure,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    res.clearCookie(STATE_COOKIE);
    res.redirect("/");
  } catch {
    res.redirect("/?login=error");
  }
});

// Current user (or null).
authRouter.get("/auth/me", (req: AuthedRequest, res) => {
  res.json({ user: publicUser(req.user) });
});

authRouter.post("/auth/logout", (_req, res) => {
  res.clearCookie(COOKIE);
  res.json({ ok: true });
});
