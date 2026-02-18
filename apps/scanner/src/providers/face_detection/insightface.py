"""InsightFace face detection + embedding provider."""

from pathlib import Path

from insightface.app import FaceAnalysis

from src.config import settings
from src.matching.detector import DetectedFace
from src.providers.base import FaceDetectionProvider
from src.utils.image_download import load_and_resize
from src.utils.logging import get_logger

log = get_logger("provider.insightface")


class InsightFaceFaceDetection(FaceDetectionProvider):
    """Face detection and embedding via InsightFace (buffalo_sc / ArcFace)."""

    def __init__(self) -> None:
        self._model: FaceAnalysis | None = None

    def init_model(self, model_name: str | None = None) -> None:
        name = model_name or settings.insightface_model
        log.info("loading_insightface_model", model=name)
        self._model = FaceAnalysis(name=name, providers=["CPUExecutionProvider"])
        self._model.prepare(ctx_id=0, det_size=(640, 640))
        log.info("insightface_model_loaded", model=name)

    def get_model(self) -> FaceAnalysis:
        if self._model is None:
            raise RuntimeError(
                "InsightFace model not initialized. Call init_model() first."
            )
        return self._model

    def detect(self, image_path: Path) -> list[DetectedFace]:
        img = load_and_resize(image_path)
        if img is None:
            return []

        try:
            model = self.get_model()
            faces = model.get(img)
        except Exception as e:
            log.error("face_detection_error", path=str(image_path), error=str(e))
            return []

        results = []
        for face in faces:
            bbox = face.bbox.astype(int)
            results.append(
                DetectedFace(
                    bbox=(int(bbox[0]), int(bbox[1]), int(bbox[2]), int(bbox[3])),
                    detection_score=float(face.det_score),
                    aligned_face=face.normed_embedding,
                )
            )

        return results
