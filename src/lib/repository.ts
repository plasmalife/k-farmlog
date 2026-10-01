import { supabase } from "./supabase";
import {
  todayKST,
  type Site,
  type Note,
  type Entry,
  type Photo,
  type Post,
} from "./domain";
function client() {
  if (!supabase) throw new Error("Supabase 연결이 필요합니다.");
  return supabase;
}
export async function userId() {
  const {
    data: { user },
  } = await client().auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");
  return user.id;
}
export async function loadData() {
  const db = client();
  const [s, n, e, p] = await Promise.all([
    db.from("cultivation_sites").select("*").order("created_at"),
    db.from("notes").select("*").order("note_date", { ascending: false }),
    db.from("entries").select("*").order("created_at"),
    db.from("note_photos").select("*"),
  ]);
  for (const r of [s, n, e, p])
    if (r.error)
      throw new Error(
        "기록을 불러오지 못했습니다. 연결과 데이터베이스 설정을 확인해 주세요.",
      );
  const photos: Photo[] = await Promise.all(
    (p.data || []).map(async (photo) => {
      const { data } = await db.storage
        .from("farm-photos")
        .createSignedUrl(photo.path, 3600);
      return { ...photo, url: data?.signedUrl };
    }),
  );
  return {
    sites: (s.data || []) as Site[],
    notes: (n.data || []).map((note) => ({
      ...note,
      entries: (e.data || []).filter((entry) => entry.note_id === note.id),
      photos: photos.filter((photo) => photo.note_id === note.id),
    })) as Note[],
  };
}
export async function addSite(site: Omit<Site, "id">) {
  const { data, error } = await client()
    .from("cultivation_sites")
    .insert({ ...site, user_id: await userId() })
    .select()
    .single();
  if (error) throw new Error("재배지를 저장하지 못했습니다.");
  return data as Site;
}
export async function ensureNote(site: Site, date = todayKST()) {
  const db = client(),
    uid = await userId();
  const { data, error } = await db.from("notes").upsert(
    {
      user_id: uid,
      site_id: site.id,
      note_date: date,
      region: site.region,
      crop: site.crop,
    },
    { onConflict: "user_id,site_id,note_date", ignoreDuplicates: true },
  );
  if (error) throw new Error("노트를 만들지 못했습니다.");
  void data;
  const found = await db
    .from("notes")
    .select("*")
    .eq("user_id", uid)
    .eq("site_id", site.id)
    .eq("note_date", date)
    .single();
  if (found.error) throw new Error("노트를 찾지 못했습니다.");
  return found.data as Note;
}
export async function saveEntry(
  noteId: string,
  kind: Entry["kind"],
  content: string,
  keywords: string[] = [],
  id = crypto.randomUUID(),
) {
  const { error } = await client()
    .from("entries")
    .upsert(
      { id, user_id: await userId(), note_id: noteId, kind, content, keywords },
      { onConflict: "id" },
    );
  if (error) throw new Error("기록을 저장하지 못했습니다. 다시 시도해 주세요.");
  return id;
}
export async function savePhoto(
  noteId: string,
  slot: number,
  blob: Blob,
  score: number,
  description: string,
) {
  const db = client(),
    uid = await userId(),
    path = `${uid}/${noteId}/${slot}.jpg`;
  const { error: uploadError } = await db.storage
    .from("farm-photos")
    .upload(path, blob, {
      contentType: "image/jpeg",
      upsert: true,
      cacheControl: "0",
    });
  if (uploadError)
    throw new Error("사진 업로드에 실패했습니다. 텍스트 기록은 유지됩니다.");
  const { error } = await db.from("note_photos").upsert(
    {
      note_id: noteId,
      user_id: uid,
      slot,
      path,
      score,
      description,
      pinned: false,
      created_at: new Date().toISOString(),
    },
    { onConflict: "note_id,slot" },
  );
  if (error)
    throw new Error("사진 정보를 저장하지 못했습니다. 다시 시도해 주세요.");
}
export async function deleteEntry(id: string) {
  const { error } = await client().from("entries").delete().eq("id", id);
  if (error) throw new Error("삭제하지 못했습니다.");
}
export async function editEntry(id: string, content: string) {
  const { error } = await client()
    .from("entries")
    .update({ content })
    .eq("id", id);
  if (error) throw new Error("수정하지 못했습니다.");
}
export async function pinPhoto(photo: Photo) {
  const { error } = await client()
    .from("note_photos")
    .update({ pinned: !photo.pinned })
    .eq("note_id", photo.note_id)
    .eq("slot", photo.slot);
  if (error) throw new Error("대표 사진 설정을 변경하지 못했습니다.");
}
export async function loadPosts(page = 0) {
  const { data, error } = await client()
    .from("community_posts")
    .select("*")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(page * 20, page * 20 + 19);
  if (error) throw new Error("친구 소식을 불러오지 못했습니다.");
  return await Promise.all(
    (data || []).map(async (post) => {
      const paths = post.photo_paths || [];
      const { data: urls } = paths.length
        ? await client()
            .storage.from("community-photos")
            .createSignedUrls(paths, 3600)
        : { data: [] };
      return {
        ...post,
        photo_urls: (urls || []).map((p) => p.signedUrl).filter(Boolean),
      } as Post;
    }),
  );
}
export async function createPost(
  content: string,
  site: Site,
  nickname: string,
  photos: Blob[] = [],
  id = crypto.randomUUID(),
) {
  const uid = await userId();
  const paths: string[] = [];
  for (let i = 0; i < photos.length; i++) {
    const path = `${uid}/${id}/${i + 1}.jpg`;
    const { error } = await client()
      .storage.from("community-photos")
      .upload(path, photos[i], { contentType: "image/jpeg", upsert: true });
    if (error)
      throw new Error("소식 사진을 올리지 못했습니다. 다시 시도해 주세요.");
    paths.push(path);
  }
  const { error } = await client().from("community_posts").upsert({
    id,
    photo_paths: paths,
    user_id: uid,
    nickname,
    region: site.region,
    crop: site.crop,
    content,
  });
  if (error) throw new Error("소식을 올리지 못했습니다.");
}
export async function removePost(id: string) {
  const { data } = await client()
    .from("community_posts")
    .select("photo_paths")
    .eq("id", id)
    .single();
  if (data?.photo_paths?.length) {
    const { error } = await client()
      .storage.from("community-photos")
      .remove(data.photo_paths);
    if (error)
      throw new Error("사진을 삭제하지 못했습니다. 다시 시도해 주세요.");
  }
  const { error } = await client()
    .from("community_posts")
    .delete()
    .eq("id", id);
  if (error) throw new Error("소식을 삭제하지 못했습니다.");
}
export async function runAI(form: FormData) {
  const {
    data: { session },
  } = await client().auth.getSession();
  if (!session) throw new Error("로그인이 필요합니다.");
  const response = await fetch("/api/ai", {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: form,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "AI 처리에 실패했습니다.");
  return result as {
    content: string;
    keywords: string[];
    region: string;
    crop: string;
    date: string;
    score: number;
    changed: boolean;
    transcript?: string;
  };
}

export async function deletePhoto(photo: Photo) {
  const { error: storageError } = await client()
    .storage.from("farm-photos")
    .remove([photo.path]);
  if (storageError) throw new Error("사진을 삭제하지 못했습니다.");
  const { error } = await client()
    .from("note_photos")
    .delete()
    .eq("note_id", photo.note_id)
    .eq("slot", photo.slot);
  if (error)
    throw new Error("사진 정보를 삭제하지 못했습니다. 다시 시도해 주세요.");
}
