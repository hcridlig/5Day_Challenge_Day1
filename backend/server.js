const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const ort = require('onnxruntime-node');
const sharp = require('sharp');

const app = express();
app.use(cors());

// On stocke les images uploadées dans le dossier "uploads"
const upload = multer({ dest: 'uploads/' });

// Chemin du modèle ONNX
const modelPath = "best.onnx";
let session = null;

// Charger le modèle ONNX au démarrage du serveur
ort.InferenceSession.create(modelPath)
  .then(s => {
    session = s;
    console.log("[INFO] Modèle ONNX chargé avec succès depuis :", modelPath);
    console.log("[INFO] session.inputNames  =", session.inputNames);
    console.log("[INFO] session.outputNames =", session.outputNames);
  })
  .catch(err => {
    console.error("[ERREUR] lors du chargement du modèle ONNX:", err);
  });

// (optionnel) Softmax si besoin pour classification
function softmax(arr) {
  const maxVal = Math.max(...arr);
  const exps = arr.map(x => Math.exp(x - maxVal));
  const sumExps = exps.reduce((a, b) => a + b, 0);
  return exps.map(exp => exp / sumExps);
}

async function runLogoDetection(imagePath) {
  if (!session) {
    throw new Error("[ERREUR] Modèle non chargé (session est null).");
  }

  console.log("\n[DEBUG] === Début de runLogoDetection() ===");
  console.log("[DEBUG] imagePath =", imagePath);

  // 1) Prétraitement de l'image
  const { data, info } = await sharp(imagePath)
    .resize(640, 640) // YOLO attend souvent 640x640 (ou taille identique au training)
    .removeAlpha() // supprime le canal alpha si présent
    .raw()
    .toBuffer({ resolveWithObject: true });

  console.log("[DEBUG] Dimensions de l'image après resize :", info);
  console.log("[DEBUG] Nombre de pixels bruts (data.length) :", data.length);

  // 2) Normalisation : [0,1]
  const floatData = Float32Array.from(data).map(x => x / 255.0);
  console.log("[DEBUG] floatData.length =", floatData.length);

  const [channels, height, width] = [info.channels, info.height, info.width];
  console.log("[DEBUG] channels =", channels, "| height =", height, "| width =", width);

  // 3) Réorganisation HWC -> CHW
  const tensorData = new Float32Array(channels * height * width);
  for (let h = 0; h < height; h++) {
    for (let w = 0; w < width; w++) {
      for (let c = 0; c < channels; c++) {
        tensorData[c * height * width + h * width + w] =
          floatData[h * width * channels + w * channels + c];
      }
    }
  }

  // 4) Création du tenseur d'entrée
  const inputShape = [1, channels, height, width];
  console.log("[DEBUG] inputTensor shape =", inputShape);

  const inputTensor = new ort.Tensor('float32', tensorData, inputShape);
  const feeds = { [session.inputNames[0]]: inputTensor };

  console.log("[DEBUG] Début de l'inférence ONNX...");
  // 5) Inférence
  const results = await session.run(feeds);
  console.log("[DEBUG] Inférence terminée.");

  // On suppose qu'il n'y a qu'une sortie
  const outputName = session.outputNames[0];
  const outputTensor = results[outputName];

  // Debug : affichage
  console.log("[DEBUG] Dimensions du tenseur de sortie :", outputTensor.dims);
  // On affiche un peu plus qu'avant (50 valeurs) pour info
  console.log("[DEBUG] Extrait des 50 premières valeurs de la sortie :", 
    Array.from(outputTensor.data).slice(0, 50)
  );

  // Conversion de l'image en base64 (pour l'afficher dans le frontend)
  const processedImageBase64 = fs.readFileSync(imagePath, { encoding: 'base64' });

  // ============================================================
  // Si la sortie est [1, 9, 8400], on doit la transposer en [1, 8400, 9]
  // ============================================================
  const dims = outputTensor.dims; // ex. [1, 9, 8400]
  const dataArr = outputTensor.data; // Float32Array

  // 4 classes effectives => 9 colonnes = 4 coords + 1 objConf + 4 classProbs
  const companies = [
    'apple-logo',
    'google-logo',
    'intel-logo',
    'microsoft-logo'
    // 'nvidia-logo' // <-- Avec 9 colonnes, on n'a que 4 classes
  ];

  // Vérifions si c'est bien [1, 9, 8400]
  if (dims.length === 3 && dims[0] === 1 && dims[1] === 9) {
    const H = dims[1]; // 9
    const W = dims[2]; // 8400
    console.log("[DEBUG] On identifie un format [1, 9, 8400]. On va transposer en [1, 8400, 9].");
    console.log("[DEBUG] => H =", H, ", W =", W);

    // On crée un nouveau tableau pour la transposition (9x8400 => 8400x9)
    const transposed = new Float32Array(dataArr.length);

    for (let i = 0; i < H; i++) {
      for (let j = 0; j < W; j++) {
        // index source (i,j)
        const srcIndex = i * W + j;
        // index destination (j,i)
        const dstIndex = j * H + i;
        transposed[dstIndex] = dataArr[srcIndex];
      }
    }
    console.log("[DEBUG] Transposition terminée. newDims = [1, 8400, 9].");

    // On parse la dimension 8400 (chaque ligne fait 9 valeurs)
    let bestScore = 0;
    let bestClass = -1;

    // On peut logger quelques valeurs (par exemple les 5 premiers anchors) 
    // pour vérifier si on voit des conf > 0.
    // Mais attention au volume !
    console.log("[DEBUG] On va inspecter les 5 premiers 'rows' après transposition :");
    for (let row = 0; row < Math.min(5, W); row++) {
      const offset = row * H; // row*9
      const x = transposed[offset + 0];
      const y = transposed[offset + 1];
      const w_ = transposed[offset + 2];
      const h_ = transposed[offset + 3];
      const objConf = transposed[offset + 4];
      const cProbs = transposed.slice(offset + 5, offset + 9);

      console.log(`[DEBUG] Row ${row}: 
        x=${x.toFixed(2)}, y=${y.toFixed(2)}, w=${w_.toFixed(2)}, h=${h_.toFixed(2)},
        objConf=${objConf.toFixed(2)}, classProbs=${cProbs.map(v => v.toFixed(2)).join(',')}
      `);
    }

    for (let row = 0; row < W; row++) {
      const offset = row * H; // row*9
      const objConf = transposed[offset + 4];
      // 4 classProbs => indices 5..8
      const cProbs = transposed.slice(offset + 5, offset + 9);

      // Trouver la classe la plus probable
      let maxClassProb = 0;
      let maxClassIdx = -1;
      for (let c = 0; c < cProbs.length; c++) {
        if (cProbs[c] > maxClassProb) {
          maxClassProb = cProbs[c];
          maxClassIdx = c;
        }
      }

      // Score final = objConf * maxClassProb
      const finalScore = objConf * maxClassProb;
      if (finalScore > bestScore) {
        bestScore = finalScore;
        bestClass = maxClassIdx;
      }
    }

    const threshold = 0.5;
    console.log(`[DEBUG] Meilleur score trouvé = ${bestScore.toFixed(4)} 
      (threshold = ${threshold}), bestClass = ${bestClass}`);

    let detectedLogo = 'Inconnu';
    if (bestScore >= threshold && bestClass >= 0 && bestClass < companies.length) {
      detectedLogo = companies[bestClass];
    }
    console.log(`[DEBUG] detectedLogo = ${detectedLogo}`);

    console.log("[DEBUG] === Fin de runLogoDetection() ===\n");
    return {
      detectedLogo,
      processedImageBase64,
      bestScore
    };
  }

  // ------------------------------------------------
  // Si le tenseur n'est pas [1, 9, 8400], on retombe
  // sur un code plus générique (ou on renvoie Inconnu).
  // ------------------------------------------------

  console.log("[WARN] Le tenseur n'est pas [1, 9, 8400], on renvoie Inconnu.");
  console.log("[DEBUG] === Fin de runLogoDetection() ===\n");
  return {
    detectedLogo: 'Inconnu',
    processedImageBase64,
    bestScore: 0
  };
}

// -------------------------------------------------------
// Endpoint /api/detect
// -------------------------------------------------------
app.post('/api/detect', upload.single('image'), async (req, res) => {
  if (!req.file) {
    console.error("[ERREUR] Aucune image reçue.");
    return res.status(400).json({ error: 'Aucun fichier uploadé' });
  }
  const imagePath = req.file.path;
  console.log("[INFO] Fichier uploadé :", imagePath);

  try {
    const result = await runLogoDetection(imagePath);

    // Suppression du fichier temporaire
    fs.unlink(imagePath, err => {
      if (err) console.error('[WARN] Erreur lors de la suppression du fichier:', err);
    });

    // Retour au front
    console.log(`[INFO] Résultat final : company=${result.detectedLogo}, score=${result.bestScore}`);
    return res.json({
      company: result.detectedLogo,
      score: result.bestScore, // entre 0 et 1
      processedImage: `data:image/jpeg;base64,${result.processedImageBase64}`
    });

  } catch (error) {
    fs.unlink(imagePath, err => {
      if (err) console.error('[WARN] Erreur lors de la suppression du fichier:', err);
    });
    console.error('[ERREUR] runLogoDetection a levé une exception :', error);
    return res.status(500).json({
      error: 'Erreur lors de la détection du logo',
      details: error.message
    });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`[INFO] Backend démarré sur le port ${PORT}`);
});
