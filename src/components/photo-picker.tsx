"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, Upload, Trash2 } from "lucide-react";
import { compressPhoto } from "@/lib/images";
export default function PhotoPicker({
  photos,
  onChange,
  disabled = false,
}: {
  photos: Blob[];
  onChange: (photos: Blob[]) => void;
  disabled?: boolean;
}) {
  const camera = useRef<HTMLInputElement>(null),
    upload = useRef<HTMLInputElement>(null);
  const [urls, setUrls] = useState<string[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  useEffect(() => {
    const next = photos.map(URL.createObjectURL);
    setUrls(next);
    return () => next.forEach(URL.revokeObjectURL);
  }, [photos]);
  async function select(files: FileList | null) {
    if (!files) return;
    setError("");
    if (photos.length + files.length > 3) {
      setError(
        "사진은 최대 3장입니다. 잘못 찍은 사진을 삭제한 뒤 다시 선택해 주세요.",
      );
      return;
    }
    setLoading(true);
    try {
      onChange([
        ...photos,
        ...(await Promise.all(Array.from(files).map(compressPhoto))),
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "사진을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <fieldset className="photo-picker" disabled={disabled || loading}>
      <legend>사진 {photos.length} / 3</legend>
      <input
        ref={camera}
        aria-label="카메라 사진"
        hidden
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          void select(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={upload}
        aria-label="사진 파일"
        hidden
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={(e) => {
          void select(e.target.files);
          e.target.value = "";
        }}
      />
      <div className="photo-inputs">
        <button
          className="secondary"
          disabled={photos.length === 3}
          onClick={() => camera.current?.click()}
        >
          <Camera size={20} /> 사진 찍기
        </button>
        <button
          className="secondary"
          disabled={photos.length === 3}
          onClick={() => upload.current?.click()}
        >
          <Upload size={20} /> 사진 올리기
        </button>
      </div>
      <div className="draft-photos">
        {urls.map((url, i) => (
          <div key={url}>
            <button
              className="remove-photo"
              aria-label={`사진 ${i + 1} 삭제`}
              onClick={() => onChange(photos.filter((_, j) => j !== i))}
            >
              <Trash2 size={16} /> 삭제
            </button>
            <img src={url} alt={`사진 ${i + 1} 미리보기`} />
          </div>
        ))}
      </div>
      {loading && <p role="status">사진을 준비하고 있습니다.</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
