# DonorLedger — IPserverone VPS Deployment

Step-by-step manual deploy guide for **IPserverone NovaCloud** (Malaysia-Cyberjaya
region). Estimated total time: ~45 minutes if everything goes smoothly.

> Prereq: you have already run the project successfully on your Windows
> machine (QUICKSTART.md steps 0-7). The same code now goes onto the VPS.

---

## Phase 1 — Provision the VPS (5 min)

1. Log into IPserverone dashboard → **NovaCloud** → **Create Instance**.
2. Image: **Ubuntu 22.04 LTS**
3. Region: **Malaysia-Cyberjaya (MYS1a)** — judges are local; lowest latency.
4. Specs (minimum):
   - 2 vCPU
   - 4 GB RAM (less will OOM when Postgres + Redis + Node + Hardhat compile run together)
   - 40 GB SSD
   - Allocate a public IPv4
5. **SSH key**: paste the contents of your public key. On Windows generate one with:
   ```powershell
   ssh-keygen -t ed25519 -C "donorledger-deploy"
   type $env:USERPROFILE\.ssh\id_ed25519.pub
   ```
   Copy the printed line into the IPserverone SSH key field.
6. Launch the instance. Note the public IP (referred to as `VPS_IP` below).

---

## Phase 2 — Initial server setup (10 min)

SSH in from your Windows machine:
```powershell
ssh root@VPS_IP
```

(If first connection asks about authenticity, type `yes`.)

Once in, run these blocks in order:

### 2a. System update + essentials
```bash
apt update && apt upgrade -y
apt install -y curl git ufw build-essential ca-certificates
timedatectl set-timezone Asia/Kuala_Lumpur
date  # confirm it shows MYT
```

### 2b. Node.js 20
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v   # → v20.x
npm -v
```

### 2c. Docker + Compose plugin
```bash
curl -fsSL https://get.docker.com | sh
apt install -y docker-compose-plugin
docker --version
docker compose version
systemctl enable --now docker
```

### 2d. PM2 (process manager)
```bash
npm install -g pm2
pm2 -v
```

### 2e. Firewall
```bash
ufw allow OpenSSH
ufw allow 3001/tcp        # backend API
ufw allow 80/tcp          # for optional Nginx later
ufw allow 443/tcp         # for optional SSL later
ufw --force enable
ufw status
```

### 2f. (Recommended) non-root deploy user
Running everything as root works but is bad practice. Create a normal user:
```bash
adduser donorledger          # set a password
usermod -aG docker,sudo donorledger
mkdir -p /home/donorledger/.ssh
cp /root/.ssh/authorized_keys /home/donorledger/.ssh/
chown -R donorledger:donorledger /home/donorledger/.ssh
chmod 700 /home/donorledger/.ssh
chmod 600 /home/donorledger/.ssh/authorized_keys
```

Test login from a **new** PowerShell terminal (keep the root SSH open as backup):
```powershell
ssh donorledger@VPS_IP
```

Everything below assumes you're SSH'd in as `donorledger`.

---

## Phase 3 — Deploy the application (20 min)

### 3a. Get the code onto the VPS

**Option A — GitHub (recommended):**
```bash
cd ~
git clone https://github.com/<yourname>/donorledger.git
cd donorledger
```

**Option B — direct upload from Windows** (if you haven't pushed to GitHub yet):

From your **Windows machine**, in a new PowerShell tab:
```powershell
cd "D:\Hackerthon Project"
# Use scp (built into Windows 10+); skip node_modules and uploads
scp -r DonorLedger donorledger@VPS_IP:~/
# OR use tar over ssh for a faster copy:
tar --exclude=node_modules --exclude=uploads --exclude=.git --exclude=contracts/artifacts --exclude=contracts/cache -czf - DonorLedger | ssh donorledger@VPS_IP "cd ~ && tar xzf -"
```

Then on the VPS:
```bash
cd ~/donorledger
ls   # confirm CLAUDE.md, package.json, backend/, contracts/ etc. are there
```

### 3b. Create the `.env`
```bash
cp .env.example .env
nano .env
```

Paste in all the same values you used locally (see QUICKSTART.md step 0).
**The only line that differs** from your local config:
```
FRONTEND_ORIGIN=http://VPS_IP:5173
# OR if the frontend is also on the VPS / has its own domain:
# FRONTEND_ORIGIN=https://donorledger.example.com
```

Save (`Ctrl+O`, `Enter`, `Ctrl+X`).

### 3c. Start Postgres + Redis
```bash
docker compose up -d
docker compose ps           # both should show (healthy) within 10 s
docker compose logs --tail 20 postgres
```

### 3d. Install dependencies
```bash
npm install
cd contracts && npm install && cd ..
```

### 3e. Compile + test contracts
```bash
npm run contracts:compile
npm run contracts:test      # 25 tests should pass
```

### 3f. Deploy contracts to Monad

Make sure your two MetaMask wallets still hold MON.
```bash
npm run contracts:deploy
```

The script prints two addresses. Copy them into `.env`:
```bash
nano .env
# paste the values into:
#   REGISTRY_CONTRACT_ADDRESS=0x...
#   DONOR_TRACKER_CONTRACT_ADDRESS=0x...
```

### 3g. Database — migrate + seed
```bash
npm run prisma:migrate -- --name init
npm run prisma:seed
```

### 3h. Start with PM2
```bash
mkdir -p logs
pm2 start ecosystem.config.cjs
pm2 logs donorledger        # confirm the boot lines; Ctrl+C to detach
pm2 save                    # persist current process list
pm2 startup                 # prints a sudo command — copy/paste it
```

The `pm2 startup` command creates a systemd unit so the backend
auto-restarts after a reboot. Run the exact command it prints (it
will start with `sudo env PATH=...`).

---

## Phase 4 — Verify from outside (5 min)

From your **Windows** terminal (not SSH):

```powershell
curl http://VPS_IP:3001/health
```

Should return JSON with both wallet addresses and `demoMode: true`.

Run the smoke test against the VPS:
```powershell
cd "D:\Hackerthon Project\DonorLedger"
$env:API_BASE_URL="http://VPS_IP:3001"
npm run smoke
```

You should see 11 green ticks. Open webhook.site — the MACC fraud
alert payload is there with the AI score and on-chain pause tx hash.

---

## Phase 5 — Optional: Nginx reverse proxy + Let's Encrypt SSL

Only do this if you have a domain (or a free DuckDNS / nip.io alias).
Skip if you're demoing with the raw `http://VPS_IP:3001` URL — totally
acceptable for the hackathon.

### 5a. Install
```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

### 5b. Site config
```bash
sudo nano /etc/nginx/sites-available/donorledger
```

Paste:
```nginx
server {
    listen 80;
    server_name donorledger.example.com;   # ← your domain

    client_max_body_size 12M;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 90s;
    }
}
```

### 5c. Enable + reload + SSL
```bash
sudo ln -sf /etc/nginx/sites-available/donorledger /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d donorledger.example.com   # follow prompts
```

Then change `FRONTEND_ORIGIN` in `.env` to your `https://` URL and
`pm2 restart donorledger`.

---

## Phase 6 — Day-to-day operations

### Re-deploy after a code change
```bash
cd ~/donorledger
git pull            # or scp the changed files
npm install         # only if package.json changed
npm run contracts:compile   # only if .sol changed
pm2 restart donorledger
pm2 logs donorledger --lines 50
```

### Tail the logs
```bash
pm2 logs donorledger
# or directly:
tail -f ~/donorledger/logs/donorledger.out.log
```

### Wipe + reseed the DB (start fresh)
```bash
cd ~/donorledger
pm2 stop donorledger
docker compose down -v          # ← -v wipes the volume, kills data
docker compose up -d
npm run prisma:migrate -- --name init
npm run prisma:seed
pm2 start donorledger
```

### Check resource usage
```bash
pm2 monit              # interactive
docker stats           # container CPU/RAM
df -h                  # disk
free -h                # RAM
```

### Save NovaCloud points between rehearsals
NovaCloud bills by the hour while the instance is running.
When you're not actively demoing:
```bash
# Inside the VPS:
sudo poweroff
```
Then in the IPserverone dashboard, the instance shows as **Stopped**.
Start it again the day of judging. PM2 + Postgres + the contracts on
Monad all persist — you just lose the in-flight Bull queue jobs (which
is fine, the AI worker re-runs failed jobs anyway).

---

## Troubleshooting

**`docker compose up -d` says "permission denied"**
You forgot to add yourself to the docker group. Either:
```bash
sudo usermod -aG docker $USER
# then log out and back in (groups only refresh on new session)
```
Or just prefix every docker command with `sudo`.

**`pm2 start` says "Cannot find module"**
You ran it before `npm install`. Re-run `npm install`, then `pm2 restart donorledger`.

**Smoke test fails on `/api/admin/campaign/create`**
Almost always: `contracts/artifacts/` is missing. SSH in and run
`npm run contracts:compile`. Restart PM2.

**Smoke test fails on a chain call with "insufficient funds"**
The Bank Islam wallet ran out of MON. Faucet refill, then retry.
You can check balance with:
```bash
curl -sX POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getBalance","params":["0xYOUR_WALLET","latest"],"id":1}' \
  https://testnet-rpc.monad.xyz
```

**Backend boots but the smoke test gets connection refused**
UFW is dropping port 3001. Run `sudo ufw status` — make sure `3001/tcp ALLOW`
appears. If not: `sudo ufw allow 3001/tcp && sudo ufw reload`.

**Memory pressure (`Out of memory: Killed process`)**
2 GB is the bare minimum. Either upgrade the instance or add swap:
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h     # confirm Swap line shows 2 GB
```

**Postgres container won't stay up**
Almost always a stale volume from a previous bad run. Wipe and retry:
```bash
docker compose down -v
docker compose up -d
docker compose logs postgres --tail 30
```
