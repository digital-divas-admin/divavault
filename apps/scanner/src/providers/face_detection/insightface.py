"""InsightFace face detection + embedding provider."""

import os
from pathlib import Path

from insightface.app import FaceAnalysis

from src.config import settings
from src.matching.detector import DetectedFace
from src.providers.base import FaceDetectionProvider
from src.utils.image_download import load_and_resize
from src.utils.logging import get_logger

log = get_logger("provider.insightface")


def _add_nvidia_dll_paths() -> None:
    """Add nvidia pip package DLL dirs to PATH so ONNX Runtime can find cuDNN."""
    try:
        import nvidia.cudnn
        cudnn_bin = os.path.join(nvidia.cudnn.__path__[0], "bin")
        if os.path.isdir(cudnn_bin) and cudnn_bin not in os.environ.get("PATH", ""):
            os.environ["PATH"] = cudnn_bin + os.pathsep + os.environ.get("PATH", "")
            log.info("added_cudnn_to_path", path=cudnn_bin)
    except ImportError:
        pass
    try:
        import nvidia.cublas
        cublas_bin = os.path.join(nvidia.cublas.__path__[0], "bin")
        if os.path.isdir(cublas_bin) and cublas_bin not in os.environ.get("PATH", ""):
            os.environ["PATH"] = cublas_bin + os.pathsep + os.environ.get("PATH", "")
            log.info("added_cublas_to_path", path=cublas_bin)
    except ImportError:
        pass


class InsightFaceFaceDetection(FaceDetectionProvider):
    """Face detection and embedding via InsightFace (buffalo_sc / ArcFace)."""

    def __init__(self) -> None:
        self._model: FaceAnalysis | None = None

    def init_model(self, model_name: str | None = None) -> None:
        name = model_name or settings.insightface_model
        _add_nvidia_dll_paths()
        providers = ["CUDAExecutionProvider", "CPUExecutionProvider"]
        log.info("loading_insightface_model", model=name, requested_providers=providers)
        self._model = FaceAnalysis(name=name, providers=providers)
        self._model.prepare(ctx_id=0, det_size=(640, 640))

        # Log the actual provider selected by ONNX Runtime
        active_providers = []
        for m in self._model.models.values():
            sess_providers = getattr(m, "providers", None) or (
                m.session.get_providers() if hasattr(m, "session") else []
            )
            for p in sess_providers:
                if p not in active_providers:
                    active_providers.append(p)
        log.info("insightface_model_loaded", model=name, active_providers=active_providers)

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
