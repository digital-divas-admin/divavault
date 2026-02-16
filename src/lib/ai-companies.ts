import type { AICompany } from "@/types/optout";

/**
 * Static registry of AI companies for opt-out management.
 *
 * Each entry describes the company's data practices, opt-out method,
 * and step-by-step instructions for users to exercise their rights.
 */
export const AI_COMPANIES: AICompany[] = [
  {
    slug: "openai",
    name: "OpenAI",
    description:
      "OpenAI develops large language models and image generators (DALL-E, GPT). They may use publicly available images and text to train foundation models.",
    method: "web_form",
    contactEmail: null,
    optOutUrl: "https://privacy.openai.com/policies?modal=take-my-content-out-of-training",
    instructionsMarkdown: `1. Visit the [OpenAI content opt-out form](https://privacy.openai.com/policies?modal=take-my-content-out-of-training).\n2. Fill in your name, email, and a description of the data you want excluded.\n3. Submit the form and save the confirmation email for your records.\n4. OpenAI typically responds within 30 days.`,
    dataPractices:
      "OpenAI collects publicly available text and images from the internet to train its foundation models, including GPT and DALL-E.",
    category: "model_training",
  },
  {
    slug: "stability-ai",
    name: "Stability AI",
    description:
      "Stability AI builds open-source image generation models (Stable Diffusion) trained on large-scale image datasets scraped from the web.",
    method: "email",
    contactEmail: "privacy@stability.ai",
    optOutUrl: null,
    instructionsMarkdown: `1. Send an email to **privacy@stability.ai** with the subject line "Data Opt-Out Request".\n2. Include your full name, a description of the data to be removed, and any URLs where your images appear.\n3. Attach a government-issued ID or other proof of identity if requested.`,
    dataPractices:
      "Stability AI trains image generation models on datasets such as LAION, which contain billions of image-text pairs scraped from the public web.",
    category: "image_generation",
  },
  {
    slug: "midjourney",
    name: "Midjourney",
    description:
      "Midjourney is an AI image generation service that creates images from text prompts, trained on a large corpus of publicly available artwork and photography.",
    method: "email",
    contactEmail: "privacy@midjourney.com",
    optOutUrl: null,
    instructionsMarkdown: `1. Email **privacy@midjourney.com** with the subject "Opt-Out / Data Deletion Request".\n2. Include your full name and links to any images or works you want excluded from training data.\n3. Midjourney may request additional verification of identity or ownership.`,
    dataPractices:
      "Midjourney trains its image generation model on publicly available images and artwork collected from the internet.",
    category: "image_generation",
  },
  {
    slug: "meta-ai",
    name: "Meta AI",
    description:
      "Meta uses data from Facebook and Instagram to train AI models including Llama and image generation tools. Users can object to this processing through privacy settings.",
    method: "web_form",
    contactEmail: null,
    optOutUrl: "https://www.facebook.com/help/contact/6359191084165019",
    instructionsMarkdown: `1. Visit the [Meta AI data objection form](https://www.facebook.com/help/contact/6359191084165019).\n2. Select your country of residence and fill in the required fields.\n3. Describe specifically that you object to your facial/biometric data being used for AI model training.\n4. Submit the form and note the reference number provided.`,
    dataPractices:
      "Meta uses content posted on Facebook and Instagram, including photos and associated metadata, to train its AI models such as Llama and Meta AI image features.",
    category: "model_training",
  },
  {
    slug: "google-deepmind",
    name: "Google DeepMind",
    description:
      "Google DeepMind develops AI models including Gemini and Imagen. Google may use publicly available data and user content to improve AI services.",
    method: "web_form",
    contactEmail: null,
    optOutUrl: "https://support.google.com/websearch?p=ai_data_optout",
    instructionsMarkdown: `1. Go to [Google's AI data opt-out page](https://support.google.com/websearch?p=ai_data_optout).\n2. Sign in with your Google account.\n3. Follow the prompts to request exclusion of your data from AI training.\n4. You can also submit a data deletion request through Google's Privacy tools at myaccount.google.com.`,
    dataPractices:
      "Google uses publicly available web data, Google product usage data, and user-generated content to train AI models including Gemini and Imagen.",
    category: "model_training",
  },
  {
    slug: "anthropic",
    name: "Anthropic",
    description:
      "Anthropic builds the Claude family of AI assistants. They primarily use licensed and curated datasets but accept opt-out requests for any included data.",
    method: "email",
    contactEmail: "privacy@anthropic.com",
    optOutUrl: null,
    instructionsMarkdown: `1. Send an email to **privacy@anthropic.com** with the subject "Data Opt-Out Request".\n2. Include your full name, contact information, and a description of the data you want removed.\n3. Anthropic will confirm receipt and process the request in accordance with applicable privacy laws.`,
    dataPractices:
      "Anthropic trains Claude models using curated and licensed datasets, and honors individual opt-out requests for data removal from training corpora.",
    category: "model_training",
  },
  {
    slug: "adobe-firefly",
    name: "Adobe Firefly",
    description:
      "Adobe Firefly generates images using AI trained on Adobe Stock, licensed content, and public domain works. Users can manage AI training preferences in their Adobe account.",
    method: "account_settings",
    contactEmail: null,
    optOutUrl: "https://account.adobe.com/privacy",
    instructionsMarkdown: `1. Sign in to your Adobe account at [account.adobe.com](https://account.adobe.com).\n2. Navigate to **Privacy** settings.\n3. Under "Content analysis", toggle off the option that allows Adobe to use your content for AI training.\n4. Changes take effect immediately for future training runs.`,
    dataPractices:
      "Adobe trains Firefly models on Adobe Stock images, licensed content, and public domain works, and offers account-level controls for content analysis preferences.",
    category: "image_generation",
  },
  {
    slug: "deviantart",
    name: "DeviantArt",
    description:
      "DeviantArt is an online art community that introduced AI-generated art features. Artists can tag their work to opt out of third-party AI training datasets.",
    method: "account_settings",
    contactEmail: null,
    optOutUrl: "https://www.deviantart.com/settings/general",
    instructionsMarkdown: `1. Log in to your DeviantArt account.\n2. Go to **Settings** > **General**.\n3. Find the "AI & Third Parties" section.\n4. Enable the option to set the **noai** and **noimageai** meta tags on all your deviations, which signals to AI scrapers that your work should not be used for training.`,
    dataPractices:
      "DeviantArt hosts user-created artwork that may be scraped by third-party AI training pipelines; the platform provides meta tag controls to signal opt-out preferences.",
    category: "content_platform",
  },
  {
    slug: "reddit",
    name: "Reddit",
    description:
      "Reddit licenses user-generated content to AI companies for model training. Users can adjust their profile settings to limit data usage.",
    method: "account_settings",
    contactEmail: null,
    optOutUrl: "https://www.reddit.com/settings/privacy",
    instructionsMarkdown: `1. Log in to your Reddit account.\n2. Navigate to **Settings** > **Privacy**.\n3. Turn off the toggle for "Allow Reddit to use your posts and comments for AI training."\n4. Note that previously licensed data may still exist in third-party datasets.`,
    dataPractices:
      "Reddit licenses user posts, comments, and associated metadata to third-party AI companies for use in model training through commercial data agreements.",
    category: "social_media",
  },
  {
    slug: "x-twitter",
    name: "X (Twitter)",
    description:
      "X (formerly Twitter) uses posts and user data to train its Grok AI model. Users can opt out through privacy settings on the platform.",
    method: "account_settings",
    contactEmail: null,
    optOutUrl: "https://x.com/settings/privacy_and_safety",
    instructionsMarkdown: `1. Log in to your X account.\n2. Go to **Settings and Support** > **Settings and privacy** > **Privacy and safety**.\n3. Under "Grok", toggle off "Allow your posts as well as your interactions, inputs, and results with Grok to be used for training and fine-tuning."\n4. Save your changes.`,
    dataPractices:
      "X uses public posts, interactions, and user-generated content to train its Grok AI model and related machine learning systems.",
    category: "social_media",
  },
  {
    slug: "civitai",
    name: "CivitAI",
    description:
      "CivitAI is a community platform for sharing AI-generated images and fine-tuned models. It currently does not provide a formal opt-out mechanism for individuals whose likenesses appear in hosted models.",
    method: "none",
    contactEmail: "support@civitai.com",
    optOutUrl: null,
    instructionsMarkdown: `1. CivitAI does not currently offer a formal opt-out process for individuals.\n2. You can email **support@civitai.com** to request removal of specific models or images that use your likeness without consent.\n3. Include links to the offending content and proof of identity.\n4. Consider filing a DMCA takedown if your likeness is being used without authorization.`,
    dataPractices:
      "CivitAI hosts community-uploaded AI models and generated images; individuals whose likenesses appear in fine-tuned models have limited formal recourse through the platform.",
    category: "content_platform",
  },
  {
    slug: "hugging-face",
    name: "Hugging Face",
    description:
      "Hugging Face is an open-source AI model hub hosting thousands of models and datasets. It does not directly train models on user data but hosts third-party datasets that may contain personal information.",
    method: "none",
    contactEmail: "privacy@huggingface.co",
    optOutUrl: null,
    instructionsMarkdown: `1. Hugging Face does not have a centralized opt-out mechanism for hosted datasets.\n2. Email **privacy@huggingface.co** to request removal of your data from specific datasets.\n3. Include the dataset name, links to your data within it, and proof of identity.\n4. You may also flag specific datasets or models through Hugging Face's community reporting tools.`,
    dataPractices:
      "Hugging Face hosts third-party datasets and models that may contain personal data including images; the platform provides community reporting tools for content concerns.",
    category: "content_platform",
  },
];

/**
 * Lookup map keyed by company slug for O(1) access.
 */
export const AI_COMPANIES_MAP: Record<string, AICompany> = Object.fromEntries(
  AI_COMPANIES.map((company) => [company.slug, company])
);

/**
 * Retrieve a single AI company by slug.
 * Returns `undefined` if the slug is not found.
 */
export function getAICompany(slug: string): AICompany | undefined {
  return AI_COMPANIES_MAP[slug];
}
