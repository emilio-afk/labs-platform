import {
  createBlock,
  createChallengeStep,
  createQuizQuestion,
  type DayBlock,
} from "@/utils/dayBlocks";

export function createVideoTextChallengeTemplateBlocks(): DayBlock[] {
  const primaryVideo = createBlock("video");
  const supportText = createBlock("text");
  const challengeGuide = createBlock("challenge_steps");

  primaryVideo.group = "resource";
  primaryVideo.role = "primary";
  primaryVideo.url = "";
  primaryVideo.caption = "Título o referencia del recurso principal";

  supportText.group = "resource";
  supportText.role = "support";
  supportText.text =
    "<p><strong>Objetivo del día:</strong> [define aquí el objetivo].</p><p><strong>Contexto:</strong> [explica por qué este recurso importa].</p>";

  if (challengeGuide.type === "challenge_steps") {
    challengeGuide.group = "challenge";
    challengeGuide.role = "support";
    challengeGuide.title = "Reto del día";
    challengeGuide.steps = [
      createChallengeStep(
        "Paso 1",
        "<p>Define la situación real que quieres resolver hoy.</p>",
      ),
      createChallengeStep(
        "Paso 2",
        "<p>Aplica el prompt o marco del día con contexto específico.</p>",
      ),
      createChallengeStep(
        "Paso 3",
        "<p>Publica tu resultado y qué cambió respecto a tu versión inicial.</p>",
      ),
    ];
  }

  return [primaryVideo, supportText, challengeGuide];
}

export function createReadingQuizTemplateBlocks(): DayBlock[] {
  const principalReading = createBlock("text");
  const supportFile = createBlock("file");
  const challengeQuiz = createBlock("quiz");

  principalReading.group = "resource";
  principalReading.role = "primary";
  principalReading.text =
    "<h3>Lectura base</h3><p>[Escribe aquí la lectura o instrucciones principales del día].</p>";

  supportFile.group = "resource";
  supportFile.role = "support";
  supportFile.caption = "Recurso descargable (opcional)";
  supportFile.url = "";

  if (challengeQuiz.type === "quiz") {
    challengeQuiz.group = "challenge";
    challengeQuiz.title = "Verificación del día";
    challengeQuiz.questions = [
      {
        id: createQuizQuestion().id,
        prompt: "Pregunta 1: [escribe la pregunta]",
        options: ["Opción A", "Opción B", "Opción C"],
        correctIndex: 0,
        explanation: "Explicación opcional para retroalimentación.",
      },
    ];
  }

  return [principalReading, supportFile, challengeQuiz];
}

export function createMediaChecklistTemplateBlocks(): DayBlock[] {
  const primaryMedia = createBlock("video");
  const guideText = createBlock("text");
  const challengeGuide = createBlock("challenge_steps");

  primaryMedia.group = "resource";
  primaryMedia.role = "primary";
  primaryMedia.url = "";
  primaryMedia.caption = "Recurso audiovisual principal";

  guideText.group = "resource";
  guideText.role = "support";
  guideText.text =
    "<p><strong>Guía rápida:</strong> [pasos o contexto clave para el alumno].</p>";

  if (challengeGuide.type === "challenge_steps") {
    challengeGuide.group = "challenge";
    challengeGuide.role = "support";
    challengeGuide.title = "Pasos de la actividad";
    challengeGuide.steps = [
      createChallengeStep("Paso 1", "<p>Observa el recurso y detecta un patrón clave.</p>"),
      createChallengeStep("Paso 2", "<p>Replica el patrón con tu propio caso real.</p>"),
      createChallengeStep("Paso 3", "<p>Comparte resultado y aprendizaje en el foro.</p>"),
    ];
  }

  return [primaryMedia, guideText, challengeGuide];
}
