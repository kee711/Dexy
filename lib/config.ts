export const CDP_CONFIG = {
  projectId: process.env.NEXT_PUBLIC_CDP_PROJECT_ID ?? "",
  ethereum: { createOnLogin: "smart" },
  solana: { createOnLogin: false },
};

export const APP_CONFIG = {
  name: "Fivver for agents",
};
