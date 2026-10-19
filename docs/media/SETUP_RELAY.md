# Relay Node setup — Oracle Cloud (Always Free, $0)

> Your part is sections 1–4 (clicks in Oracle's console, ~20 min).
> Section 5 is a single paste. Section 6 is what I do in the repo after.
> Written 2026-10-20. Fallback: any €4–6 VPS (Hetzner etc.) — skip to §4.

## 1. Oracle account (once, ~10 min, has a card-verify step)

1. Go to `https://signup.cloud.oracle.com` → "Start for free".
2. Pick **Home Region FIRST — it is permanent**. Capacity roulette says avoid
   the crowd: good picks are **Milan, Zürich, Budapest, Osaka, Marseille**;
   poor picks: Ashburn, Frankfurt, São Paulo, Dublin.
3. Fill account details with your real info → credit/debit card for identity
   verification (no virtual/prepaid cards; small refundable hold, never
   charged on Always Free).
4. Wait for the confirmation email → click in, land on the Cloud Console.

## 2. Create the VM (~5 min)

Console → hamburger → Compute → Instances → **Create Instance**:

- Name: `g4m37z-relay`
- Image: **Ubuntu 22.04 or 24.04** (Canonical banner of your choice)
- Shape: **Ampere (A1 Flex, ARM)** — set **2 OCPU / 8 GB** (leaves half the
  free allowance for a future Cast Node)
- Boot volume: leave default (47 GB)
- SSH keys: choose **"Generate a key pair"** → download BOTH the private key
  (.key) and save it somewhere safe ON YOUR PHONE — this is your door key,
  there is no password recovery
- Create → wait for state `RUNNING` (~2 min) → copy the **Public IP address**
  shown on the instance page

## 3. Open the ports (the step everyone forgets — Oracle blocks ALL inbound by default)

Instance page → click the **Subnet** link → Security List **Default** →
**Add Ingress Rules** (you need 4 rules):

| Source CIDR | Protocol | Port range |
|---|---|---|
| 0.0.0.0/0 | TCP | 22 (probably exists; else add) |
| 0.0.0.0/0 | TCP | 3478 |
| 0.0.0.0/0 | UDP | 3478 |
| 0.0.0.0/0 | UDP | 49152–65535 |

(TCP 5349 for TURN-over-TLS comes later with a domain + cert; not needed for
Phase A.)

## 4. SSH in (from termux — this works, we test it right there)

```bash
# from termux, after `apt install openssh` and chmod 400 the .key file:
ssh -i ~/path/to/the.key ubuntu@<PUBLIC_IP>
```

If it connects and shows the Ubuntu banner — the hard part is done.

## 5. Deploy the relay (one paste, ~3 min)

```bash
sudo apt update -y && sudo apt install -y git
git clone --depth 1 https://github.com/G4M37Z/g4m37z-communities.git /tmp/gz
cd /tmp/gz/docs/media/relay-node
sudo bash deploy.sh
```

`deploy.sh` does: docker install → generates `TURN_SECRET` in `.env` →
configures the Ubuntu firewall → rewrites `external-ip` with the VM's real
public/private IPs → starts the relay via docker compose. **Copy the
TURN_SECRET it prints/stores — we need it in step 6.**

## 6. G4M37Z side (me, after you paste the secret into Vercel)

1. Vercel env vars (told to you here, you click them in): `TURN_SECRET`,
   `TURN_HOST` (`<PUBLIC_IP>`), realm. I wire `/api/turn-credentials` in the
   repo (spec already at `docs/media/turn-minting.spec.ts`), gate it on the
   authed session, and swap `ice-servers.ts` to fetch ephemeral per-call creds.
2. Deploy → your two-phone CGNAT test (`GAP-WEBRTC-01`) should connect for the
   first time on mobile data.

## Gotchas cheat-sheet

- **Oracle sends no monthly reminder but CAN idle-reclaim free VMs** reported
  by some users — if we see flakes we add a keepalive cron; first fix attempt
  is rebooting via console.
- Capacity error at VM create: wait 10 min, try again, or switch Availability
  Domain in the same region.
- The SSH key lives only on your phone — losing it means Oracle console →
  "Create a new instance from backup" dance; register a second key later.
- If a call still says "Connecting" after step 6: first suspect the ingress
  rules of §3, not the code — UDP ranges are the #1 misconfigured item.
