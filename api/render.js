export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb"
    }
  }
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method === "GET") {
    return res.status(200).json({
      success: true,
      message: "iLog AI renderer is ready"
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: "Missing OPENAI_API_KEY in Vercel environment variables"
      });
    }

    const {
      floorplanImage,
      sections,
      totalSections,
      totalAreaSqFt,
      instruction
    } = req.body || {};

    if (!floorplanImage) {
      return res.status(400).json({
        success: false,
        error: "Missing floorplanImage"
      });
    }

    const prompt = `
Create a realistic exterior architectural rendering of an iLog modular home.

Use the attached top-view floor plan image as the main layout reference.

Important rules:
- Straight-line modular home only.
- Use the number and proportions of the visible modules.
- Make it look like a real buildable small modular house.
- Modern warm design.
- Natural wood structural language.
- Black window frames.
- Simple roofline.
- Clean foundation.
- No fantasy shapes.
- No curved walls.
- No extra wings or L-shapes.
- Keep the architecture simple, believable, and investor-presentation quality.

Project data:
- Sections: ${JSON.stringify(sections)}
- Total sections: ${totalSections}
- Total area: ${totalAreaSqFt} sq ft
- Instruction: ${instruction || ""}
`;

    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-5.5",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: prompt
              },
              {
                type: "input_image",
                image_url: floorplanImage
              }
            ]
          }
        ],
        tools: [
          {
            type: "image_generation"
          }
        ]
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

    if (!imageCall || !imageCall.result) {
      return res.status(500).json({
        success: false,
        error: "No image returned from OpenAI",
        details: data
      });
    }

    const generatedImage = `data:image/png;base64,${imageCall.result}`;

    return res.status(200).json({
      success: true,
      message: "AI render generated",
      image: generatedImage
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
