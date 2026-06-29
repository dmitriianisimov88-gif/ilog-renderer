import fs from "fs";
import path from "path";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "20mb"
    }
  }
};

function readPromptFile() {
  const promptPath = path.join(process.cwd(), "prompts", "ilog-render-prompt.txt");
  return fs.existsSync(promptPath)
    ? fs.readFileSync(promptPath, "utf8")
    : "Create a realistic iLog modular home rendering.";
}

function getReferenceImageUrls(req) {
  const refsDir = path.join(process.cwd(), "public", "references");

  if (!fs.existsSync(refsDir)) return [];

  const files = fs
    .readdirSync(refsDir)
    .filter(file => /\.(png|jpg|jpeg|webp)$/i.test(file))
    .slice(0, 6);

  const host = req.headers.host;
  const protocol = host?.includes("localhost") ? "http" : "https";

  return files.map(file => `${protocol}://${host}/references/${file}`);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method === "GET") {
    return res.status(200).json({
      success: true,
      message: "iLog renderer is live",
      promptLoaded: true
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const {
      floorplanImage,
      sections,
      totalSections,
      totalAreaSqFt,
      dimensions,
      instruction
    } = req.body || {};

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: "Missing OPENAI_API_KEY"
      });
    }

    if (!floorplanImage) {
      return res.status(400).json({
        success: false,
        error: "Missing floorplanImage"
      });
    }

    const basePrompt = readPromptFile();
    const referenceUrls = getReferenceImageUrls(req);

    const fullPrompt = `
${basePrompt}

Exact project data:
${JSON.stringify(
  {
    sections,
    totalSections,
    totalAreaSqFt,
    dimensions,
    instruction
  },
  null,
  2
)}

Use the uploaded floor-plan PNG as the layout source.
Use the reference images as iLog visual style references.
Keep the result buildable, realistic, modular, and consistent with the iLog brand.
`;

    const content = [
      {
        type: "input_text",
        text: fullPrompt
      },
      {
        type: "input_image",
        image_url: floorplanImage
      },
      ...referenceUrls.map(url => ({
        type: "input_image",
        image_url: url
      }))
    ];

    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-5.5",
        input: [
          {
            role: "user",
            content
          }
        ],
        tools: [
          {
            type: "image_generation",
            size: "1024x1024",
            quality: "medium"
          }
        ],
        tool_choice: {
          type: "image_generation"
        }
      })
    });

    const data = await openaiResponse.json();

    if (!openaiResponse.ok) {
      return res.status(openaiResponse.status).json({
        success: false,
        error: "OpenAI request failed",
        details: data
      });
    }

    const imageCall = data.output?.find(
      item => item.type === "image_generation_call"
    );

    if (!imageCall?.result) {
      return res.status(500).json({
        success: false,
        error: "No image returned from OpenAI",
        details: data
      });
    }

    return res.status(200).json({
      success: true,
      message: "AI render generated",
      image: `data:image/png;base64,${imageCall.result}`,
      referenceImagesUsed: referenceUrls
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
