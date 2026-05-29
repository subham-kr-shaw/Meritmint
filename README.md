# MeritMint

MeritMint is a full-stack Stellar Testnet dApp for issuing non-transferable academic credential NFTs. An institution wallet initializes the Soroban contract as the admin, then mints on-chain certificate records directly to student wallet addresses. Each credential stores the student name, course, and issue date on-chain, and students can open or share a proof-of-credential link that resolves the credential from Soroban storage in the frontend.

## Tech Stack

- Rust + Soroban SDK smart contract
- Next.js 14 App Router frontend
- TypeScript
- Tailwind CSS
- `@stellar/stellar-sdk`
- Freighter browser wallet

## Prerequisites

- Rust installed:
  `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- Wasm target:
  `rustup target add wasm32-unknown-unknown`
- Stellar CLI:
  `cargo install --locked stellar-cli --features opt`
- Node.js 18+
- Freighter wallet browser extension installed from https://freighter.app

## Project Structure

```text
meritmint/
├── contracts/
│   ├── Cargo.toml                  # Soroban contract package manifest
│   └── src/
│       └── lib.rs                  # MeritMint credential contract with tests
├── frontend/
│   ├── app/
│   │   ├── globals.css             # Global Tailwind and visual theme styles
│   │   ├── layout.tsx              # Root layout, metadata, and font setup
│   │   └── page.tsx                # Main landing page for the dApp
│   ├── components/
│   │   ├── MainFeature.tsx         # Admin/student modes and contract UI
│   │   └── WalletConnect.tsx       # Freighter connect/disconnect/fund controls
│   ├── lib/
│   │   ├── contract.ts             # Soroban contract invocation helpers
│   │   └── stellar.ts              # Freighter, Horizon, Friendbot, Testnet config
│   ├── types/
│   │   └── index.ts                # Shared frontend credential and result types
│   ├── .env.example                # Frontend Testnet environment variables
│   ├── next-env.d.ts               # Next.js TypeScript definitions
│   ├── next.config.mjs             # Next.js runtime configuration
│   ├── package.json                # Frontend scripts and dependencies
│   ├── postcss.config.js           # PostCSS config for Tailwind
│   ├── tailwind.config.ts          # Tailwind content paths and theme extensions
│   └── tsconfig.json               # TypeScript compiler settings
└── README.md                       # End-to-end setup and usage guide
```

## Step 1 — Build the Smart Contract

```bash
cd contracts
cargo build --target wasm32-unknown-unknown --release
```

This compiles the Soroban contract to WebAssembly for Stellar. The output file will be:

```text
contracts/target/wasm32-unknown-unknown/release/meritmint.wasm
```

That `.wasm` file is what you deploy to Stellar Testnet in the next step.

## Step 2 — Set Up a Testnet Identity

```bash
stellar keys generate --global my-key --network testnet
stellar keys address my-key
```

This creates a Testnet keypair in your Stellar CLI key store and prepares it for Testnet use. Use the printed public address any time you want to inspect the account in a Testnet explorer or fund it manually with Friendbot.

## Step 3 — Deploy Contract to Testnet

```bash
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/meritmint.wasm \
  --source my-key \
  --network testnet
```

The CLI returns a Contract ID after deployment succeeds. Copy that value exactly; you will need it in Step 5 for the frontend.

## Step 4 — Install Frontend Dependencies

```bash
cd ../frontend
npm install
```

This installs Next.js, Tailwind, the Stellar JavaScript SDK, and the Freighter browser integration package.

## Step 5 — Configure Environment Variables

```bash
cp .env.example .env.local
```

Open `frontend/.env.local` and paste the Contract ID from Step 3 into `NEXT_PUBLIC_CONTRACT_ID`. The other values are already pinned to Stellar Testnet:

```env
NEXT_PUBLIC_CONTRACT_ID=YOUR_DEPLOYED_CONTRACT_ID
NEXT_PUBLIC_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
NEXT_PUBLIC_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org
```

## Step 6 — Run the Frontend

```bash
npm run dev
```

Open http://localhost:3000

## Step 7 — Using the App

- Install Freighter at https://freighter.app and set it to Testnet mode.
  Settings → Network → Testnet
- Click `Connect Wallet` to link your Freighter wallet.
- Click `Get Testnet XLM` if your wallet does not have free Testnet XLM yet.
- If the contract has not been initialized yet, enter the institution name and click `Initialize`.
  The connected wallet becomes the on-chain admin for MeritMint.
- Switch to `Admin Mode`.
- Enter the student wallet address, student name, course, and issue date.
- Click `Mint Credential` and approve the transaction in Freighter.
- Copy the generated proof link, or share a URL in the format:
  `http://localhost:3000/?credential=1`
- Switch to `Student Mode` to load all credentials for a student wallet address.
- Open a proof link to verify a single credential directly from on-chain Soroban state.

## Smart Contract Functions

- `init(admin: Address, institution: String)`  
  Write. Initializes the contract one time, stores the admin wallet, and stores the institution name.

- `mint(student: Address, student_name: String, course: String, issue_date: String) -> u64`  
  Write. Admin-only function that mints a new non-transferable credential record and returns its on-chain credential ID.

- `is_initialized() -> bool`  
  Read. Returns `true` if the contract already has an admin and institution configured.

- `get_admin() -> Address`  
  Read. Returns the institution admin wallet address.

- `get_institution() -> String`  
  Read. Returns the saved institution name.

- `total_credentials() -> u64`  
  Read. Returns the total number of credentials minted so far.

- `get_credential(credential_id: u64) -> Credential`  
  Read. Returns one full credential record by ID.

- `get_student_credentials(student: Address) -> Vec<u64>`  
  Read. Returns all credential IDs owned by a student wallet.

- `get_student_credential_details(student: Address) -> Vec<Credential>`  
  Read. Returns all full credential records for a student wallet.

- `has_credential(student: Address, course: String) -> bool`  
  Read. Returns `true` if that student already holds a credential for the supplied course name.

## Common Errors & Fixes

- `Transaction simulation failed`
  The contract is not deployed, the contract ID is wrong, or the contract is not initialized. Verify `NEXT_PUBLIC_CONTRACT_ID` in `frontend/.env.local`.

- `Freighter not found`
  Install the Freighter browser extension and refresh the page.

- `Account not found`
  Fund the connected wallet with Testnet XLM first by clicking `Get Testnet XLM`.

- `wasm32 target not found`
  Run:
  `rustup target add wasm32-unknown-unknown`

## Testnet Resources

- Stellar Testnet Explorer: https://stellar.expert/explorer/testnet
- Stellar Lab (manual transactions): https://lab.stellar.org
- Friendbot: https://friendbot.stellar.org/?addr=YOUR_PUBLIC_KEY
