export async function compressPhoto(file: File): Promise<Blob> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error(
      "JPG, PNG, WEBP 사진을 선택해 주세요. 아이폰 HEIC 사진은 JPG로 변환해 주세요.",
    );
  if (file.size > 20 * 1024 * 1024)
    throw new Error("사진 한 장은 20MB 이내로 선택해 주세요.");
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("사진을 변환하지 못했습니다.")),
      "image/jpeg",
      0.82,
    ),
  );
}
