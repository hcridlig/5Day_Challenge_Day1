const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');

const app = express();
app.use(cors());

// Configuration de multer pour sauvegarder les images dans le dossier "uploads"
const upload = multer({ dest: 'uploads/' });

// Fonction de détection fictive
function runLogoDetection(imagePath) {
  // Remplacez cette fonction par l'appel à votre modèle exporté.
  // Ici, nous simulons une détection qui retourne toujours "Google".
  const detectedLogo = "Google";
  
  // Pour la démo, nous renvoyons l'image d'origine encodée en base64.
  const processedImageBase64 = fs.readFileSync(imagePath, { encoding: 'base64' });
  
  return { detectedLogo, processedImageBase64 };
}

// Endpoint pour traiter l'image envoyée
app.post('/api/detect', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Aucun fichier uploadé' });
  }

  const imagePath = req.file.path;
  
  // Exécuter la détection sur l'image
  const result = runLogoDetection(imagePath);
  
  // Supprimer le fichier temporaire
  fs.unlink(imagePath, (err) => {
    if (err) console.error('Erreur lors de la suppression du fichier:', err);
  });
  
  // Retourner le résultat (nom du logo et image traitée)
  res.json({
    company: result.detectedLogo,
    processedImage: `data:image/jpeg;base64,${result.processedImageBase64}`
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend démarré sur le port ${PORT}`);
});
