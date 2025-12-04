export type Category = {
  id: string;
  label: string;
};

export type AgentExample =
  | { type: "text"; title: string; body: string }
  | { type: "image"; title: string; url: string; caption?: string }
  | { type: "code"; title: string; language: string; code: string };

export type AgentReview = {
  id: string;
  user: string;
  rating: number;
  comment: string;
};

export type Agent = {
  id: string;
  name: string;
  author: string;
  description: string | null;
  price: number | null;
  rating?: number;
  rating_avg?: number | null;
  rating_count?: number;
  category: string;
  score?: number;
  similarity?: number;
  fitness_score?: number;
  rank?: number;
  pricing_model?: string | null;
  url?: string | null;
  test_score?: number | null;
  rationale?: string;
  examples?: AgentExample[];
  reviews?: AgentReview[];
};

export const categories: Category[] = [
  { id: "ppt", label: "Presentation & PPT" },
  { id: "dev", label: "Development" },
  { id: "resume", label: "Resume" },
  { id: "marketing", label: "Marketing" },
  { id: "analysis", label: "Analysis" },
  { id: "ops", label: "Operations" },
  { id: "cartoonist", label: "Cartoonist" },
  { id: "research", label: "Research" },
];
