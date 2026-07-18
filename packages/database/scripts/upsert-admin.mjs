import { stdin, stdout } from "node:process";
import { disconnectPrisma, getPrisma } from "../dist/index.js";
import { hashPassword } from "../dist/auth.js";

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const name = process.env.ADMIN_NAME?.trim() || "Administrador";

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("ADMIN_EMAIL deve conter um e-mail válido.");
  process.exitCode = 1;
} else {
  const password = process.env.ADMIN_INITIAL_PASSWORD || await readSecret("Senha inicial do administrador: ");
  if (password.length < 12 || password.length > 128) {
    console.error("A senha deve ter entre 12 e 128 caracteres.");
    process.exitCode = 1;
  } else {
    try {
      const passwordHash = await hashPassword(password);
      await getPrisma().user.upsert({
        where: { email },
        create: { email, name, passwordHash, role: "ADMIN", isActive: true },
        update: { name, passwordHash, role: "ADMIN", isActive: true },
      });
      console.info("Administrador cadastrado ou atualizado com segurança.");
    } catch {
      console.error("Não foi possível cadastrar o administrador. Verifique a conexão com o banco.");
      process.exitCode = 1;
    } finally {
      await disconnectPrisma();
    }
  }
}

async function readSecret(prompt) {
  if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
    console.error("Defina ADMIN_INITIAL_PASSWORD ou execute o script em um terminal interativo.");
    process.exit(1);
  }

  stdout.write(prompt);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  let value = "";

  try {
    for await (const chunk of stdin) {
      for (const character of chunk) {
        if (character === "\u0003") throw new Error("cancelled");
        if (character === "\r" || character === "\n") {
          stdout.write("\n");
          return value;
        }
        if (character === "\u007f") value = value.slice(0, -1);
        else value += character;
      }
    }
    return value;
  } finally {
    stdin.setRawMode(false);
    stdin.pause();
  }
}
