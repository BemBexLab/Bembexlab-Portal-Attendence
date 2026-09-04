const path = require("node:path");

const rootDirectory = __dirname;
const clientDirectory = path.join(rootDirectory, "client");
const serverDirectory = path.join(rootDirectory, "server");

module.exports = {
  apps: [
    {
      name: "nest-server",
      cwd: serverDirectory,
      script: path.join(serverDirectory, "dist", "main.js"),
      interpreter: process.execPath,
      watch: false,
      autorestart: true,
      restart_delay: 3000,
      max_memory_restart: "768M",
      env: {
        NODE_ENV: "production",
        PORT: 4000,
      },
    },
    {
      name: "next-client",
      cwd: clientDirectory,
      script: path.join(
        clientDirectory,
        "node_modules",
        "next",
        "dist",
        "bin",
        "next",
      ),
      args: ["start", "-p", "3000"],
      interpreter: process.execPath,
      watch: false,
      autorestart: true,
      restart_delay: 3000,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
