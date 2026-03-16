#!/usr/bin/env bash
# 在本地执行：通过 SSH 在服务器上拉代码、安装依赖、构建并重启 PM2，使项目上线
# 用法: ./scripts/deploy-to-server.sh
# 前置: 1) 已 push 到 origin main  2) 服务器 ~/iqproject 已配置 .env.local

set -e

SERVER_USER="${DEPLOY_USER:-ubuntu}"
SERVER_HOST="${DEPLOY_HOST:-34.220.87.202}"
SERVER_KEY="${DEPLOY_SSH_KEY:-}"
PROJECT_DIR="${DEPLOY_PROJECT_DIR:-\$HOME/iqproject}"
PM2_APP="${DEPLOY_PM2_APP:-iqproject}"

SSH_OPTS=(-o StrictHostKeyChecking=accept-new -o ConnectTimeout=15)
[[ -n "$SERVER_KEY" ]] && SSH_OPTS+=(-i "$SERVER_KEY")

ssh "${SSH_OPTS[@]}" "$SERVER_USER@$SERVER_HOST" "set -e;
  echo '==> cd $PROJECT_DIR';
  cd $PROJECT_DIR;
  echo '==> git fetch + reset to origin/main (丢弃服务器本地修改)';
  git fetch origin main;
  git reset --hard origin/main;
  echo '==> npm install';
  npm install;
  echo '==> npm run build';
  npm run build;
  echo '==> pm2 restart $PM2_APP --update-env';
  pm2 restart $PM2_APP --update-env;
  echo '==> pm2 status';
  pm2 status;
  echo '==> 部署完成'"

echo ""
echo "部署已完成。若需查看日志: ssh $SERVER_USER@$SERVER_HOST 'pm2 logs $PM2_APP --lines 50'"
