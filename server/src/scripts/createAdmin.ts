import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../db/prisma";

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminUsername = process.env.ADMIN_USERNAME || "admin";

  if (!adminEmail || !adminPassword) {
    console.error("请设置环境变量 ADMIN_EMAIL 和 ADMIN_PASSWORD。");
    console.error("示例：ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=yourpassword pnpm ts-node src/scripts/createAdmin.ts");
    process.exit(1);
  }

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: adminEmail }, { username: adminUsername }] },
  });

  if (existing) {
    console.log("管理员账号已存在：", existing.email);
    await prisma.$disconnect();
    return;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const user = await prisma.user.create({
    data: {
      username: adminUsername,
      email: adminEmail,
      passwordHash,
      role: "admin",
    },
  });

  console.log("管理员账号创建成功：", user.email, "(", user.username, ")");
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("创建管理员失败：", error);
  process.exit(1);
});
