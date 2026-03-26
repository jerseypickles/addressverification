import prisma from "./db.server.js";

export class MongoSessionStorage {
  async storeSession(session) {
    const data = {
      shop: session.shop,
      state: session.state,
      isOnline: session.isOnline,
      scope: session.scope || null,
      expires: session.expires || null,
      accessToken: session.accessToken || "",
      userId: session.onlineAccessInfo?.associated_user?.id
        ? Number(session.onlineAccessInfo.associated_user.id)
        : null,
      firstName: session.onlineAccessInfo?.associated_user?.first_name || null,
      lastName: session.onlineAccessInfo?.associated_user?.last_name || null,
      email: session.onlineAccessInfo?.associated_user?.email || null,
      accountOwner: session.onlineAccessInfo?.associated_user?.account_owner || false,
      locale: session.onlineAccessInfo?.associated_user?.locale || null,
      collaborator: session.onlineAccessInfo?.associated_user?.collaborator || false,
      emailVerified: session.onlineAccessInfo?.associated_user?.email_verified || false,
      refreshToken: session.refreshToken || null,
      refreshTokenExpires: session.refreshTokenExpires || null,
    };

    const existing = await prisma.session.findUnique({ where: { id: session.id } });

    if (existing) {
      await prisma.session.update({
        where: { id: session.id },
        data,
      });
    } else {
      await prisma.session.create({
        data: { id: session.id, ...data },
      });
    }

    return true;
  }

  async loadSession(id) {
    const row = await prisma.session.findUnique({ where: { id } });
    if (!row) return undefined;

    const { Session } = await import("@shopify/shopify-api");
    const session = new Session({
      id: row.id,
      shop: row.shop,
      state: row.state,
      isOnline: row.isOnline,
    });

    session.scope = row.scope;
    session.expires = row.expires;
    session.accessToken = row.accessToken;
    session.refreshToken = row.refreshToken;
    session.refreshTokenExpires = row.refreshTokenExpires;

    return session;
  }

  async deleteSession(id) {
    try {
      await prisma.session.delete({ where: { id } });
    } catch (e) {
      // Session might not exist
    }
    return true;
  }

  async deleteSessions(ids) {
    await prisma.session.deleteMany({ where: { id: { in: ids } } });
    return true;
  }

  async findSessionsByShop(shop) {
    const rows = await prisma.session.findMany({ where: { shop } });
    const { Session } = await import("@shopify/shopify-api");

    return rows.map((row) => {
      const session = new Session({
        id: row.id,
        shop: row.shop,
        state: row.state,
        isOnline: row.isOnline,
      });
      session.scope = row.scope;
      session.expires = row.expires;
      session.accessToken = row.accessToken;
      session.refreshToken = row.refreshToken;
      session.refreshTokenExpires = row.refreshTokenExpires;
      return session;
    });
  }
}
