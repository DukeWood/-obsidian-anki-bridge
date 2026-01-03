/**
 * Create ObsidianFlashcardPro note type in Anki
 * Based on research best practices
 */

const MODEL_NAME = "ObsidianFlashcardPro";

const CSS = `
/* =============================================
   OBSIDIAN FLASHCARD PRO - Research-Based CSS
   ============================================= */

:root {
  --bg-primary: #fafafa;
  --bg-secondary: #f0f0f0;
  --text-primary: #2c2c2c;
  --text-secondary: #666666;
  --accent: #2563eb;
  --border: #e5e5e5;
  --success: #22c55e;
  --hint-color: #9333ea;
}

.night_mode {
  --bg-primary: #1a1a1a;
  --bg-secondary: #2d2d2d;
  --text-primary: #e5e5e5;
  --text-secondary: #a0a0a0;
  --accent: #60a5fa;
  --border: #404040;
  --success: #4ade80;
  --hint-color: #c084fc;
}

.card {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 19px;
  line-height: 1.6;
  text-align: left;
  color: var(--text-primary);
  background-color: var(--bg-primary);
  max-width: 650px;
  margin: 0 auto;
  padding: 40px 24px;
  word-wrap: break-word;
}

/* Mobile */
.mobile .card {
  font-size: 20px;
  padding: 20px 16px;
}

/* Question styling */
.question {
  font-size: 1.1em;
  margin-bottom: 1em;
}

/* Answer divider */
hr#answer {
  border: none;
  border-top: 2px solid var(--border);
  margin: 24px 0;
}

/* Answer styling */
.answer {
  margin-bottom: 1em;
}

/* Extra info box */
.extra {
  background-color: var(--bg-secondary);
  padding: 16px;
  border-radius: 8px;
  margin-top: 1.5em;
  font-size: 0.9em;
  border-left: 4px solid var(--accent);
}

.extra-label {
  font-weight: 600;
  color: var(--accent);
  margin-bottom: 8px;
  font-size: 0.85em;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Hint styling */
.hint-link {
  color: var(--hint-color);
  font-size: 0.9em;
  cursor: pointer;
  text-decoration: underline;
  display: inline-block;
  margin-top: 1em;
}

.hint-content {
  background: linear-gradient(135deg, #f3e8ff 0%, #fae8ff 100%);
  padding: 12px 16px;
  border-radius: 8px;
  margin-top: 0.5em;
  font-style: italic;
  color: #6b21a8;
}

.night_mode .hint-content {
  background: linear-gradient(135deg, #3b0764 0%, #4a044e 100%);
  color: #e9d5ff;
}

/* Source reference */
.source {
  font-size: 0.8em;
  color: var(--text-secondary);
  margin-top: 1.5em;
  padding-top: 1em;
  border-top: 1px dashed var(--border);
}

/* Source link */
.source-link {
  font-size: 0.75em;
  color: var(--text-secondary);
  margin-top: 0.5em;
}

.source-link a {
  color: var(--accent);
  text-decoration: none;
}

/* Lists */
ul, ol {
  padding-left: 1.5em;
  margin: 0.5em 0;
}

li {
  margin: 0.4em 0;
}

/* Bold/emphasis */
strong, b {
  color: var(--text-primary);
  font-weight: 600;
}

/* Code */
code {
  font-family: "SF Mono", Monaco, monospace;
  font-size: 0.9em;
  background-color: var(--bg-secondary);
  padding: 2px 6px;
  border-radius: 4px;
}

/* Images */
img {
  max-width: 100% !important;
  height: auto !important;
  border-radius: 8px;
  margin: 1em 0;
}
`;

const FRONT_TEMPLATE = `<div class="question">
{{Front}}
</div>

{{#Hint}}
<a class="hint-link" onclick="document.getElementById('hint').style.display='block';this.style.display='none';">💡 Show Hint</a>
<div id="hint" class="hint-content" style="display:none;">{{Hint}}</div>
{{/Hint}}`;

const BACK_TEMPLATE = `{{FrontSide}}

<hr id="answer">

<div class="answer">
{{Back}}
</div>

{{#Extra}}
<div class="extra">
  <div class="extra-label">📚 Learn More</div>
  {{Extra}}
</div>
{{/Extra}}

{{#Source}}
<div class="source">📖 {{Source}}</div>
{{/Source}}

<div class="source-link">{{SourceLink}}</div>`;

async function invoke(action, params = {}) {
  const response = await fetch("http://localhost:8765", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, version: 6, params })
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

async function createModel() {
  // Check if model exists
  const models = await invoke("modelNames");

  if (models.includes(MODEL_NAME)) {
    console.log("Model exists, updating...");
    await invoke("updateModelStyling", {
      model: { name: MODEL_NAME, css: CSS }
    });
    await invoke("updateModelTemplates", {
      model: {
        name: MODEL_NAME,
        templates: {
          "Card 1": { Front: FRONT_TEMPLATE, Back: BACK_TEMPLATE }
        }
      }
    });
    console.log("✅ Model updated!");
    return;
  }

  // Create new model
  await invoke("createModel", {
    modelName: MODEL_NAME,
    inOrderFields: ["Front", "Back", "Extra", "Hint", "Source", "SourceLink"],
    css: CSS,
    cardTemplates: [{
      Name: "Card 1",
      Front: FRONT_TEMPLATE,
      Back: BACK_TEMPLATE
    }]
  });
  console.log("✅ Model created!");
}

async function createSampleCard() {
  // Ensure deck exists
  await invoke("createDeck", { deck: "Rina::KS3::Biology::Demo" });

  // Create sample card with all fields
  const note = {
    deckName: "Rina::KS3::Biology::Demo",
    modelName: MODEL_NAME,
    fields: {
      Front: "<strong>What type of joint is the knee?</strong>",
      Back: "A <strong>hinge joint</strong> — allows movement in <em>one plane</em> only (flexion and extension).",
      Extra: "Other hinge joints include the <strong>elbow</strong> and <strong>fingers</strong>. They work like a door hinge, allowing back-and-forth movement but not rotation.",
      Hint: "Think of a door opening and closing...",
      Source: "KS3 Biology — Skeletal System, Chapter 3",
      SourceLink: '<a href="obsidian://open?vault=RinaHighSchool&file=Flashcards/BIOL/Flashcards-Biology-Joints.md">View in Obsidian</a>'
    },
    tags: ["biology", "joints", "skeletal-system", "demo"]
  };

  try {
    const noteId = await invoke("addNote", { note });
    console.log("✅ Sample card created! Note ID:", noteId);
    return noteId;
  } catch (e) {
    if (e.message.includes("duplicate")) {
      console.log("ℹ️  Sample card already exists");
    } else {
      throw e;
    }
  }
}

async function main() {
  console.log("Creating ObsidianFlashcardPro model...\n");
  await createModel();

  console.log("\nCreating sample card...\n");
  await createSampleCard();

  console.log("\n🎉 Done! Check Anki to preview the card.");
}

main().catch(console.error);
