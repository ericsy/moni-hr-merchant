# 商家端 Jenkins Pipeline 说明

## 是否需要安装 Node？

**需要。** 商家端是 Vite + React，构建必须在本机或 Jenkins Agent 上有：

| 工具 | 建议版本 |
|------|----------|
| Node.js | **20 LTS** 或 22（Vite 7 建议 ≥18） |
| pnpm | **8.15.x**（与 `package.json` 中 `packageManager` 一致） |

在 Jenkins 服务器上安装示例（Ubuntu）：

```bash
# 方式 1：NodeSource 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo corepack enable
sudo corepack prepare pnpm@8.15.7 --activate

node -v   # v20.x
pnpm -v   # 8.15.x
```

或在 Jenkins：**Manage Jenkins → Tools → NodeJS**，安装 NodeJS 20，Pipeline 里用 `tools { nodejs 'NodeJS-20' }`。

**不必**在 Jenkins 上装 Java 才能打商家端前端包；Java 后端请另建 Job（Maven + JDK 17）。

---

## 三个 Job 与脚本对应关系

| Jenkins Job 名称（建议） | Pipeline 文件 | 默认分支 | 构建命令 |
|--------------------------|---------------|----------|----------|
| `merchant-web-dev` | `jenkins/Jenkinsfile.dev` | `develop` | `pnpm run build:dev` |
| `merchant-web-test` | `jenkins/Jenkinsfile.test` | `test` | `pnpm run build:test` |
| `merchant-web-prod` | `jenkins/Jenkinsfile.prod` | `main` | `pnpm run build:prod` |

每次构建可在 **Build with Parameters** 里修改 **GIT_BRANCH**（GitHub 分支名）。

---

## 在 Jenkins 里创建 Job

1. **New Item** → 名称如 `merchant-web-dev` → **Pipeline**。
2. **Pipeline → Definition**：选 **Pipeline script from SCM**。
3. **SCM**：Git，填 GitHub 仓库 URL（`moni-hr-react` 仓库地址）。
4. **Credentials**：GitHub PAT 或 SSH 私钥。
5. **Branch Specifier**：可填 `*/develop` 或 `**`（实际分支由参数 `GIT_BRANCH` 在 checkout 阶段覆盖）。
6. **Script Path**：`moni-hr-merchant/jenkins/Jenkinsfile.dev`（按 Job 环境选 dev/test/prod）。
7. 勾选 **This project is parameterized** 已在 Pipeline 的 `parameters` 中定义，首次构建后会出现 **GIT_BRANCH** 输入框。

若仓库在 moni-hr-react 根目录且仅含 merchant 子目录，Script Path 同上；若整个仓库就是 merchant，把 `MERCHANT_DIR` 改为 `.`。

---

## API 地址

- 构建时读取 `VITE_API_BASE_URL`（见各 `.env.dev` / `.env.test` / `.env.production`）。
- Pipeline 里 `environment { VITE_API_BASE_URL = '...' }` 可覆盖文件中的值。
- 修改后重新构建即可，无需改代码。

---

## 构建 + 部署 Nginx（Pipeline 已包含）

1. `pnpm build` → `dist/`
2. 参数 **`DEPLOY_TO_NGINX=true`** 时：`rsync -avz --delete dist/` → **`NGINX_STATIC_DIR`**
3. 执行 **`NGINX_RELOAD_CMD`**（默认 `docker exec nginx nginx -s reload`）

首次准备目录与 Nginx `root` 见上文；示例配置 **`nginx-server-example.conf`**。

---

## 使用 Docker Agent（不在宿主机装 Node 时）

将 `agent any` 改为：

```groovy
agent {
    docker {
        image 'node:20-bookworm'
        args '-u root:root'
        reuseNode true
    }
}
```

并在 `sh` 前执行 `corepack enable && corepack prepare pnpm@8.15.7 --activate`。
