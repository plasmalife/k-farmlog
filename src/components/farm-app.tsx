"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Sprout,
  Camera,
  Mic,
  BookOpen,
  Newspaper,
  Users,
  House,
  ChevronRight,
  ChevronLeft,
  Plus,
  MapPin,
  ArrowUpRight,
  Leaf,
  PenLine,
  Check,
  X,
  Settings,
  Download,
  Search,
  Trash2,
  Volume2,
  LogOut,
  ShieldCheck,
  ImagePlus,
  LoaderCircle,
} from "lucide-react";
import { supabase, configured } from "@/lib/supabase";
import {
  todayKST,
  validPhone,
  formatDate,
  readableError,
  exportNotes,
  type Site,
  type Note,
  type Entry,
  type Photo,
  type Post,
} from "@/lib/domain";
import * as repo from "@/lib/repository";
import Recorder from "./recorder";
import PhotoPicker from "./photo-picker";
import FriendFeed from "./friend-feed";
type View = "home" | "notes" | "resources" | "news" | "community" | "settings";
type Modal = "login" | "site" | "photo" | "voice" | "text" | "post" | null;
const nav = [
  { id: "home", label: "홈", icon: House },
  { id: "notes", label: "나의노트", icon: BookOpen },
  { id: "resources", label: "비료/병해충자료", icon: Leaf },
  { id: "community", label: "친구 소식", icon: Users },
] as const;
const sources = [
  {
    title: "국가농작물병해충관리시스템",
    subtitle: "작물별 병해충 정보와 발생 예찰",
    tag: "병해충",
    url: "https://ncpms.rda.go.kr/",
  },
  {
    title: "농약안전정보시스템",
    subtitle: "등록 농약과 작물별 안전 사용 정보",
    tag: "농약",
    url: "https://psis.rda.go.kr/",
  },
  {
    title: "농사로",
    subtitle: "농촌진흥청의 재배 기술과 농업 자료",
    tag: "재배·비료",
    url: "https://www.nongsaro.go.kr/",
  },
  {
    title: "농촌진흥청",
    subtitle: "농업 소식과 공식 보도자료",
    tag: "농업뉴스",
    url: "https://www.rda.go.kr/",
  },
];
function speak(text: string) {
  if ("speechSynthesis" in window) {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ko-KR";
    u.rate = 0.9;
    speechSynthesis.speak(u);
  }
}
function ModalFrame({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="modal"
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="icon-button" aria-label="닫기" onClick={onClose}>
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export default function FarmApp() {
  const [view, setView] = useState<View>("home"),
    [modal, setModal] = useState<Modal>(null),
    [logged, setLogged] = useState(false),
    [uid, setUid] = useState(""),
    [nickname, setNickname] = useState("농부");
  const [sites, setSites] = useState<Site[]>([]),
    [siteId, setSiteId] = useState(""),
    [notes, setNotes] = useState<Note[]>([]),
    [posts, setPosts] = useState<Post[]>([]),
    [selectedNote, setSelectedNote] = useState<string | null>(null);
  const [phone, setPhone] = useState(""),
    [region, setRegion] = useState(""),
    [crop, setCrop] = useState(""),
    [siteName, setSiteName] = useState(""),
    [date, setDate] = useState(todayKST()),
    [text, setText] = useState("");
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [search, setSearch] = useState(""),
    [filterDate, setFilterDate] = useState(""),
    [editId, setEditId] = useState("");
  const [lightbox, setLightbox] = useState<Photo | null>(null);
  const [draftPhotos, setDraftPhotos] = useState<Blob[]>([]);
  const [voiceMemo, setVoiceMemo] = useState("");
  const [recordingBusy, setRecordingBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [postPage, setPostPage] = useState(0),
    [morePosts, setMorePosts] = useState(false);
  const [feedError, setFeedError] = useState("");
  const preparing = useRef(false);
  const prepared = useRef<{
    signature: string;
    content: string;
    keywords: string[];
  } | null>(null);
  const slotsPlan = useRef<{ noteId: string; slots: number[] } | null>(null);
  const pending = useRef<Modal>(null);
  const entryKey = useRef(crypto.randomUUID());
  const site = sites.find((s) => s.id === siteId) || sites[0];
  const currentNote = notes.find((n) => n.id === selectedNote);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    (async () => {
      const {
        data: { session },
      } = await supabase!.auth.getSession();
      if (!session || !active) return;
      setUid(session.user.id);
      const { data } = await supabase!
        .from("profiles")
        .select("nickname")
        .eq("id", session.user.id)
        .maybeSingle();
      if (data) {
        setLogged(true);
        setNickname(data.nickname);
        try {
          const loaded = await repo.loadData();
          if (active) {
            setSites(loaded.sites);
            setSiteId(loaded.sites[0]?.id || "");
            setNotes(loaded.notes);
          }
        } catch (e) {
          setError(readableError(e));
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6500);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    function warn(e: BeforeUnloadEvent) {
      if (
        busy ||
        recordingBusy ||
        (modal && (text || voiceMemo || draftPhotos.length))
      ) {
        e.preventDefault();
      }
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy, recordingBusy, modal, text, voiceMemo, draftPhotos.length]);
  async function refreshPosts() {
    try {
      const rows = await repo.loadPosts();
      setPosts(rows);
      setPostPage(0);
      setMorePosts(rows.length === 20);
      setFeedError("");
    } catch (e) {
      setFeedError(readableError(e));
    }
  }
  useEffect(() => {
    if (!configured || !["home", "community"].includes(view)) return;
    void refreshPosts();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refreshPosts();
    }, 60000);
    return () => clearInterval(timer);
  }, [view]);
  async function refresh() {
    const data = await repo.loadData();
    setSites(data.sites);
    setNotes(data.notes);
  }
  function go(v: View) {
    setView(v);
    setSelectedNote(
      v === "notes"
        ? notes.find((n) => n.site_id === site?.id)?.id || null
        : null,
    );
    setSearch("");
    setError("");
  }
  function open(m: Modal) {
    if (!configured) {
      setError("저장 연결을 준비하고 있습니다. 잠시 후 다시 시도해 주세요.");
      return;
    }
    setDraftPhotos([]);
    setVoiceMemo("");
    prepared.current = null;
    slotsPlan.current = null;
    setError("");
    setText("");
    setEditId("");
    setDate(todayKST());
    entryKey.current = crypto.randomUUID();
    if (!logged && m !== "login") {
      pending.current = m;
      setModal("login");
      return;
    }
    if (!site && ["photo", "voice", "text"].includes(m || "")) {
      pending.current = m;
      setModal("site");
      return;
    }
    setModal(m);
  }
  function close() {
    if (busy || recordingBusy) return;
    if (
      (text || voiceMemo || draftPhotos.length) &&
      !window.confirm(
        "작성 중인 내용을 닫을까요? 저장하지 않은 내용은 사라집니다.",
      )
    )
      return;
    setModal(null);
    setText("");
    setVoiceMemo("");
    setDraftPhotos([]);
  }
  async function action(task: () => Promise<void>) {
    if (preparing.current) return;
    preparing.current = true;
    setBusy(true);
    setError("");
    try {
      await task();
    } catch (e) {
      setError(readableError(e));
    } finally {
      preparing.current = false;
      setBusy(false);
      setProgress("");
    }
  }
  async function login() {
    if (!validPhone(phone)) {
      setError("휴대전화 번호를 확인해 주세요.");
      return;
    }
    await action(async () => {
      {
        let {
          data: { session },
        } = await supabase!.auth.getSession();
        if (!session) {
          const result = await supabase!.auth.signInAnonymously();
          if (result.error)
            throw new Error(
              "회원가입 연결을 확인하고 있습니다. 잠시 후 다시 시도해 주세요.",
            );
          session = result.data.session;
        }
        if (!session) throw new Error("로그인하지 못했습니다.");
        const { error } = await supabase!.from("profiles").upsert({
          id: session.user.id,
          phone: phone.replace(/\D/g, ""),
          nickname: nickname.trim() || "농부",
        });
        if (error)
          throw new Error(
            "회원 정보를 저장하지 못했습니다. 데이터베이스 설정을 확인해 주세요.",
          );
        setUid(session.user.id);
      }
      setLogged(true);
      setPhone("");
      const loaded = await repo.loadData();
      setSites(loaded.sites);
      setNotes(loaded.notes);
      setSiteId(loaded.sites[0]?.id || "");
      setModal(
        pending.current === "post"
          ? "post"
          : loaded.sites.length
            ? pending.current
            : "site",
      );
      if (loaded.sites.length || pending.current === "post")
        pending.current = null;
    });
  }
  async function saveSite() {
    if (!region.trim() || !crop.trim()) {
      setError("지역과 작물 이름을 입력해 주세요.");
      return;
    }
    await action(async () => {
      const newSite = await repo.addSite({
        region: region.trim(),
        crop: crop.trim(),
        name: siteName.trim() || `${crop.trim()} 재배지`,
      });
      setSites((s) => [...s, newSite]);
      setSiteId(newSite.id);
      setModal(pending.current);
      pending.current = null;
      setRegion("");
      setCrop("");
      setSiteName("");
      setNotice("재배지를 등록했습니다. 오늘의 농사를 기록해 보세요.");
    });
  }
  async function saveRecord() {
    if (!site || (!text.trim() && !voiceMemo.trim() && !draftPhotos.length))
      return;
    await action(async () => {
      if (editId) {
        await repo.editEntry(editId, text.trim());
        await refresh();
        setModal(null);
        setText("");
        setNotice("기록을 수정했습니다.");
        return;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
        throw new Error("작업 날짜를 선택해 주세요.");
      const kind =
        modal === "photo" ? "photo" : modal === "voice" ? "voice" : "text";
      const loaded = await repo.loadData();
      const existing = loaded.notes.find(
        (n) => n.site_id === site.id && n.note_date === date,
      );
      if (
        !slotsPlan.current &&
        (existing?.photos.length || 0) + draftPhotos.length > 3
      )
        throw new Error(
          "이 날짜에는 사진을 3장까지 저장할 수 있습니다. 일기의 기존 사진을 삭제한 뒤 추가해 주세요.",
        );
      const memoInput = [text.trim(), voiceMemo.trim()]
        .filter(Boolean)
        .join("\n");
      const signature = `${kind}:${site.id}:${date}:${memoInput}:${draftPhotos.map((p) => p.size).join(",")}`;
      if (prepared.current?.signature !== signature) {
        const sections: string[] = [],
          allKeywords: string[] = [];
        for (let i = 0; i < draftPhotos.length; i++) {
          setProgress(
            `사진 ${i + 1}/${draftPhotos.length}의 글자를 읽고 있습니다`,
          );
          const form = new FormData();
          form.set("kind", "photo");
          form.set("file", draftPhotos[i], "photo.jpg");
          form.set("analyze", i === 0 ? "true" : "false");
          form.set(
            "context",
            JSON.stringify({ region: site.region, crop: site.crop, date }),
          );
          const r = await repo.runAI(form);
          sections.push(`[사진 ${i + 1}]\n${r.content}`);
          allKeywords.push(...r.keywords);
        }
        if (memoInput) {
          setProgress("메모를 정리하고 있습니다");
          const form = new FormData();
          form.set("kind", "text");
          form.set("text", memoInput);
          form.set(
            "context",
            JSON.stringify({
              region: site.region,
              crop: site.crop,
              date,
              source: kind,
            }),
          );
          const r = await repo.runAI(form);
          allKeywords.push(...r.keywords);
          if (kind !== "voice" && text.trim())
            sections.push(`[직접 쓴 메모]\n${text.trim()}`);
          sections.push(
            `[${kind === "voice" ? "음성 요약" : "메모 정리"}]\n${r.content}`,
          );
        }
        const content = sections.join("\n\n");
        if (content.length > 12000)
          throw new Error(
            "기록이 너무 깁니다. 사진이나 메모를 나누어 기록해 주세요.",
          );
        prepared.current = {
          signature,
          content,
          keywords: [...new Set(allKeywords)].slice(0, 30),
        };
      }
      setProgress("오늘의 일기에 저장하고 있습니다");
      const note = existing || (await repo.ensureNote(site, date));
      if (!slotsPlan.current)
        slotsPlan.current = {
          noteId: note.id,
          slots: [1, 2, 3]
            .filter((slot) => !existing?.photos.some((p) => p.slot === slot))
            .slice(0, draftPhotos.length),
        };
      if (slotsPlan.current.noteId !== note.id)
        throw new Error("날짜가 바뀌었습니다. 창을 닫고 다시 기록해 주세요.");
      for (let i = 0; i < draftPhotos.length; i++)
        await repo.savePhoto(
          note.id,
          slotsPlan.current.slots[i],
          draftPhotos[i],
          60,
          `사진 ${i + 1} · ${site.crop}`,
        );
      await repo.saveEntry(
        note.id,
        kind,
        prepared.current!.content,
        prepared.current!.keywords,
        entryKey.current,
      );
      await refresh();
      setSelectedNote(note.id);
      setView("notes");
      setModal(null);
      setText("");
      setDraftPhotos([]);
      prepared.current = null;
      slotsPlan.current = null;
      setNotice("오늘의 일기에 저장했습니다.");
    });
  }
  function download() {
    const blob = new Blob([exportNotes(notes)], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `K영농일지_${todayKST()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }
  async function deleteRecord(entry: Entry) {
    if (!confirm("이 기록을 삭제할까요? 대표 사진은 유지됩니다.")) return;
    await action(async () => {
      await repo.deleteEntry(entry.id);
      await refresh();
      setNotice("기록을 삭제했습니다.");
    });
  }
  const filtered = notes.filter(
    (n) =>
      (!filterDate || n.note_date === filterDate) &&
      (!siteId || n.site_id === siteId) &&
      (!search ||
        `${n.crop} ${n.region} ${n.entries.map((e) => e.content).join(" ")}`.includes(
          search,
        )),
  );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            go("home");
          }}
        >
          <span className="brand-mark">
            <Sprout />
          </span>
          <span>k-영농일지</span>
        </a>
        <div className="nav-caption">나의 농사 생활</div>
        <nav>
          {nav.map((item) => (
            <button
              key={item.id}
              className={view === item.id ? "active" : ""}
              onClick={() => go(item.id)}
            >
              <item.icon size={21} />
              {item.label}
              {view === item.id && <span className="nav-dot" />}
            </button>
          ))}
          <button
            className={view === "news" ? "active" : ""}
            onClick={() => go("news")}
          >
            <Newspaper size={21} />
            농업뉴스
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="small-sprout">
            <Sprout size={25} />
          </div>
          <p>
            오늘의 작은 기록이
            <br />
            내일의 농사를 만듭니다.
          </p>
          <button onClick={() => go("settings")}>
            <Settings size={18} /> 설정 및 도움말
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="mobile-brand">
            <Sprout /> K영농일지
          </div>
          <div className="header-links">
            <a
              href="https://rifamhomepage.pages.dev/"
              target="_blank"
              rel="noreferrer"
            >
              농사자료
            </a>
            <button onClick={() => go("news")}>농업뉴스</button>
            <button onClick={() => go("resources")}>비료/병해충자료</button>
          </div>
          <div className="top-actions">
            <button
              className="profile-button"
              aria-label={logged ? "내 설정" : "시작하기"}
              onClick={() => (logged ? go("settings") : open("login"))}
            >
              <span>{logged ? nickname.slice(0, 1) : "K"}</span>
              <b>{logged ? `${nickname}님` : "시작하기"}</b>
            </button>
          </div>
        </header>
        <main id="main-content">
          {view !== "home" && (
            <div className="page-top">
              <h1>
                {
                  {
                    notes: "나의노트",
                    community: "친구소식",
                    resources: "비료/병해충자료",
                    news: "농업뉴스",
                    settings: "설정 및 도움말",
                  }[view]
                }
              </h1>
            </div>
          )}
          {error && !modal && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          {site && view !== "home" && (
            <div className="site-bar">
              <MapPin size={18} />
              <select
                aria-label="재배지 선택"
                value={siteId || site.id}
                onChange={(e) => {
                  setSiteId(e.target.value);
                  setSelectedNote(null);
                }}
              >
                {sites.map((s) => (
                  <option value={s.id} key={s.id}>
                    {s.region} · {s.crop} / {s.name}
                  </option>
                ))}
              </select>
              <button className="text-button" onClick={() => open("site")}>
                <Plus size={16} /> 재배지 추가
              </button>
            </div>
          )}
          {view === "home" && (
            <>
              <section className="simple-hero">
                <h1>k-영농일지</h1>
                <p>오늘도 ,수고 하셨습니다</p>
                <button
                  className="primary camera-main"
                  onClick={() => open("photo")}
                >
                  <Camera size={28} /> 사진찍기
                </button>
              </section>
              {feedError && (
                <p className="error" role="alert">
                  {feedError}
                  <button onClick={() => void refreshPosts()}>
                    다시 불러오기
                  </button>
                </p>
              )}
              <FriendFeed
                posts={posts}
                uid={uid}
                busy={busy}
                more={morePosts}
                onWrite={() => open("post")}
                onPhoto={(url) =>
                  setLightbox({
                    note_id: "",
                    slot: 1,
                    path: "",
                    score: 60,
                    description: "친구소식 사진",
                    pinned: false,
                    url,
                  })
                }
                onDelete={(p) => {
                  if (confirm("이 소식과 사진을 삭제할까요?"))
                    void action(async () => {
                      await repo.removePost(p.id);
                      await refreshPosts();
                    });
                }}
                onMore={() =>
                  void action(async () => {
                    const rows = await repo.loadPosts(postPage + 1);
                    setPosts((old) => [
                      ...old,
                      ...rows.filter((p) => !old.some((q) => q.id === p.id)),
                    ]);
                    setPostPage((p) => p + 1);
                    setMorePosts(rows.length === 20);
                  })
                }
              />
              <section className="record-shortcuts">
                <button className="primary" onClick={() => open("voice")}>
                  <Mic /> 음성으로 기록하기
                </button>
                <button className="secondary" onClick={() => open("text")}>
                  <PenLine /> 글로 기록하기
                </button>
                <button className="secondary" onClick={() => go("notes")}>
                  <BookOpen /> 나의노트
                </button>
              </section>
            </>
          )}
          {view === "notes" && !currentNote && (
            <>
              <div className="toolbar">
                <label className="search">
                  <Search size={20} />
                  <input
                    aria-label="기록 검색"
                    placeholder="작물, 작업 내용으로 찾아보세요"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <input
                  type="date"
                  aria-label="날짜로 찾기"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                />
                {filterDate && (
                  <button
                    className="text-button"
                    onClick={() => setFilterDate("")}
                  >
                    전체 날짜
                  </button>
                )}
                <button className="primary" onClick={() => open("text")}>
                  <Plus size={19} /> 기록하기
                </button>
              </div>
              {filtered.length ? (
                <div className="note-grid">
                  {filtered.map((n) => (
                    <button
                      className="note-card"
                      key={n.id}
                      onClick={() => setSelectedNote(n.id)}
                    >
                      <div className="note-cover">
                        {n.photos[0]?.url ? (
                          <Image
                            src={n.photos[0].url}
                            alt={n.photos[0].description}
                            fill
                            unoptimized
                          />
                        ) : (
                          <Sprout size={54} />
                        )}
                        <span>{n.photos.length}장의 사진</span>
                      </div>
                      <div className="note-card-copy">
                        <small>{formatDate(n.note_date)}</small>
                        <h2>
                          {n.crop} <span>· {n.region}</span>
                        </h2>
                        <p>
                          {n.entries[0]?.content ||
                            "아직 작업 메모가 없습니다."}
                        </p>
                        <div>
                          <span>기록 {n.entries.length}개</span>
                          <ChevronRight size={18} />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="panel empty-state">
                  <BookOpen size={43} />
                  <h3>
                    {search || filterDate
                      ? "일치하는 기록이 없어요"
                      : "아직 작성한 노트가 없어요"}
                  </h3>
                  <p>사진이나 목소리로 첫 영농일지를 남겨보세요.</p>
                  <button className="primary" onClick={() => open("text")}>
                    첫 기록 남기기
                  </button>
                </div>
              )}
            </>
          )}
          {view === "notes" && currentNote && (
            <section className="panel note-detail">
              <button
                className="text-button"
                onClick={() => setSelectedNote(null)}
              >
                <ChevronLeft size={18} /> 노트 목록
              </button>
              <div className="note-heading">
                <h2>오늘의 일기</h2>
                <time>
                  {currentNote.note_date
                    .replace("-", "년 ")
                    .replace("-", "월 ")}
                  일
                </time>
              </div>
              <p className="diary-context">
                {currentNote.region} / {currentNote.crop}
              </p>
              <div className="photo-grid">
                {[1, 2, 3].map((slot) => {
                  const p = currentNote.photos.find((p) => p.slot === slot);
                  return p ? (
                    <div className="photo-tile" key={slot}>
                      <button onClick={() => setLightbox(p)}>
                        {p.url && (
                          <Image
                            src={p.url}
                            alt={p.description}
                            fill
                            unoptimized
                          />
                        )}
                      </button>
                      <button
                        className="remove-photo"
                        aria-label={`저장 사진 ${slot} 삭제`}
                        disabled={busy}
                        onClick={() => {
                          if (
                            confirm("이 사진을 삭제할까요? 글은 남아 있습니다.")
                          )
                            void action(async () => {
                              await repo.deletePhoto(p);
                              await refresh();
                            });
                        }}
                      >
                        <Trash2 size={16} /> 삭제
                      </button>
                    </div>
                  ) : (
                    <button
                      className="photo-placeholder"
                      key={slot}
                      onClick={() => {
                        open("photo");
                        setDate(currentNote.note_date);
                        setSiteId(currentNote.site_id);
                      }}
                    >
                      <ImagePlus size={30} />
                      <span>사진 추가</span>
                    </button>
                  );
                })}
              </div>
              <p className="hint">날짜·재배지별 사진 최대 3장</p>
              <h2 className="daily-work-title">오늘의 작업내용</h2>
              {(["photo", "voice", "text"] as const).map((kind) => (
                <div className="entry-section" key={kind}>
                  <h3>
                    {kind === "text"
                      ? "직접 쓴 메모"
                      : kind === "voice"
                        ? "음성 요약 · 주요 키워드"
                        : "사진 분석과 메모"}
                  </h3>
                  {currentNote.entries.filter((e) => e.kind === kind).length ? (
                    currentNote.entries
                      .filter((e) => e.kind === kind)
                      .map((e) => (
                        <article className="entry" key={e.id}>
                          <div className="entry-meta">
                            <time>
                              {new Date(e.created_at).toLocaleTimeString(
                                "ko-KR",
                                {
                                  timeZone: "Asia/Seoul",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}
                            </time>
                            <div>
                              <button
                                aria-label="기록 수정"
                                onClick={() => {
                                  setModal("text");
                                  setText(e.content);
                                  setEditId(e.id);
                                  setError("");
                                }}
                              >
                                <PenLine size={17} />
                              </button>
                              <button
                                aria-label="기록 삭제"
                                disabled={busy}
                                onClick={() => void deleteRecord(e)}
                              >
                                <Trash2 size={17} />
                              </button>
                            </div>
                          </div>
                          <p>{e.content}</p>
                          <div className="tags">
                            {e.keywords.map((k, i) => (
                              <span key={`${k}-${i}`}>{k}</span>
                            ))}
                          </div>
                        </article>
                      ))
                  ) : (
                    <p className="hint">아직 남긴 기록이 없습니다.</p>
                  )}
                </div>
              ))}
              <div className="detail-actions">
                <button
                  className="primary"
                  onClick={() => {
                    open("voice");
                    setDate(currentNote.note_date);
                    setSiteId(currentNote.site_id);
                  }}
                >
                  <Mic size={18} /> 음성 추가
                </button>
                <button
                  className="secondary"
                  onClick={() => {
                    open("text");
                    setDate(currentNote.note_date);
                    setSiteId(currentNote.site_id);
                  }}
                >
                  <PenLine size={18} /> 메모 추가
                </button>
              </div>
            </section>
          )}
          {(view === "resources" || view === "news") && (
            <>
              <div className="info-banner">
                <BookOpen size={22} />
                <p>
                  공식 기관의 자료실로 연결됩니다. 병해충 판단과 농약 사용은
                  반드시 해당 작물의 등록 정보를 확인하세요.
                </p>
              </div>
              <div className="resource-grid">
                {sources
                  .filter((s) =>
                    view === "news"
                      ? s.tag === "농업뉴스"
                      : s.tag !== "농업뉴스",
                  )
                  .map((s, i) => (
                    <a
                      className="resource-card"
                      key={s.title}
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <span className="source-number">0{i + 1}</span>
                      <span className="tag">{s.tag}</span>
                      <h2>{s.title}</h2>
                      <p>{s.subtitle}</p>
                      <span className="text-button">
                        공식 자료 확인하기 <ArrowUpRight size={18} />
                      </span>
                    </a>
                  ))}
              </div>
              <p className="hint">
                공식 자료실 링크를 제공합니다. 실시간 기사 수집과 병해충 자동
                진단은 제공하지 않습니다.
              </p>
            </>
          )}
          {view === "community" && (
            <>
              <FriendFeed
                posts={posts}
                uid={uid}
                busy={busy}
                more={morePosts}
                onWrite={() => open("post")}
                onPhoto={(url) =>
                  setLightbox({
                    note_id: "",
                    slot: 1,
                    path: "",
                    score: 60,
                    description: "친구소식 사진",
                    pinned: false,
                    url,
                  })
                }
                onDelete={(p) => {
                  if (confirm("이 소식과 사진을 삭제할까요?"))
                    void action(async () => {
                      await repo.removePost(p.id);
                      await refreshPosts();
                    });
                }}
                onMore={() =>
                  void action(async () => {
                    const rows = await repo.loadPosts(postPage + 1);
                    setPosts((old) => [
                      ...old,
                      ...rows.filter((p) => !old.some((q) => q.id === p.id)),
                    ]);
                    setPostPage((p) => p + 1);
                    setMorePosts(rows.length === 20);
                  })
                }
              />
            </>
          )}
          {view === "settings" && (
            <div className="settings-grid">
              <section className="panel">
                <h2>내 재배지</h2>
                {sites.map((s) => (
                  <div className="setting-row" key={s.id}>
                    <MapPin size={20} />
                    <span>
                      <strong>{s.name}</strong>
                      <small>
                        {s.region} / {s.crop}
                      </small>
                    </span>
                  </div>
                ))}
                <button className="secondary" onClick={() => open("site")}>
                  <Plus size={18} /> 재배지 추가
                </button>
              </section>
              <section className="panel">
                <h2>기록 관리</h2>
                <button className="setting-row" onClick={download}>
                  <Download size={22} />
                  <span>
                    <strong>노트 내려받기</strong>
                    <small>전체 기록을 텍스트 파일로 저장</small>
                  </span>
                  <ChevronRight />
                </button>
                <div className="setting-row">
                  <ShieldCheck size={22} />
                  <span>
                    <strong>사진은 일기에, 음성은 요약 글로 남겨요</strong>
                    <small>음성은 핵심 내용만 문자로 남깁니다.</small>
                  </span>
                </div>
                <p className="hint">
                  계정은 이 기기의 로그인 정보와 연결됩니다. 브라우저 데이터를
                  지우거나 다른 기기를 사용하면 기존 기록에 접근할 수 없습니다.
                  중요한 기록은 내려받아 보관해 주세요.
                </p>
                {logged && (
                  <button
                    className="text-button"
                    onClick={() => {
                      if (
                        confirm(
                          "로그아웃하면 계정에 다시 접근하지 못할 수 있습니다. 기록을 내려받으셨나요?",
                        )
                      )
                        void action(async () => {
                          await supabase!.auth.signOut();
                          setLogged(false);
                          setNotes([]);
                          setSites([]);
                          setUid("");
                          setPosts([]);
                          setSiteId("");
                          go("home");
                        });
                    }}
                  >
                    <LogOut size={17} /> 로그아웃
                  </button>
                )}
              </section>
              <section className="panel">
                <h2>이용 안내</h2>
                <p>
                  전화번호는 회원 식별을 위해 사용합니다. 내 노트는 공개되지
                  않으며 AI 정리를 선택한 사진·음성·메모만 OpenAI로 전송합니다.
                </p>
                <p>
                  음성은 변환 요청 동안만 처리하며 앱의 데이터베이스나 파일
                  저장소에 저장하지 않습니다. 사진은 날짜·재배지별 최대 3장만
                  보관합니다.
                </p>
                <p className="hint">
                  연결 설정과 운영 안내는 프로젝트 README에서 확인할 수
                  있습니다.
                </p>
              </section>
            </div>
          )}
          <footer className="page-footer">
            <Sprout size={15} /> K영농일지{" "}
            <span>오늘의 수고가 내일의 자산이 되도록.</span>
          </footer>
        </main>
        <nav className="mobile-nav">
          {nav.map((item) => (
            <button
              key={item.id}
              className={view === item.id ? "active" : ""}
              onClick={() => go(item.id)}
            >
              <item.icon size={23} />
              <span>{item.label}</span>
            </button>
          ))}
          <button
            className={view === "settings" ? "active" : ""}
            onClick={() => go("settings")}
          >
            <Settings size={23} />
            <span>더보기</span>
          </button>
        </nav>
      </div>
      {notice && (
        <div className="toast" role="status">
          <Check size={20} />
          {notice}
        </div>
      )}
      {modal && (
        <ModalFrame
          title={
            {
              login: "K영농일지 시작하기",
              site: "내 재배지 등록",
              photo: "사진찍기",
              voice: "음성으로 기록하기",
              text: editId ? "기록 수정하기" : "글로 기록하기",
              post: "친구에게 소식 전하기",
            }[modal]
          }
          onClose={close}
        >
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          {modal === "login" && (
            <div className="form">
              <div className="welcome-mark">
                <Sprout size={36} />
              </div>
              <p>
                사진과 목소리로 간편하게.
                <br />
                오늘부터 나만의 영농일지를 시작하세요.
              </p>
              <label>
                이름 또는 별명
                <input
                  maxLength={30}
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="예: 행복한 농부"
                />
              </label>
              <label>
                휴대전화 번호
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="010-1234-5678"
                />
              </label>
              <p className="hint">
                문자 인증 없이 이 기기의 로그인으로 내 기록에 접근합니다.
                전화번호와 별명은 회원정보로 저장합니다.
              </p>
              <p className="hint">
                시작하면 위의 회원정보 이용 안내에 동의합니다. AI 전송은 기록
                화면에서 직접 실행할 때 이루어집니다.
              </p>
              <button
                className="primary full"
                disabled={busy}
                onClick={() => void login()}
              >
                {busy ? <LoaderCircle className="spin" /> : null}
                동의하고 시작하기
                <ChevronRight size={19} />
              </button>
            </div>
          )}
          {modal === "site" && (
            <div className="form">
              <p>시·군 단위 지역과 작물 이름을 알려주세요.</p>
              <button
                className="text-button"
                onClick={() =>
                  speak(
                    "지역을 시 또는 군 단위로 말씀해 주세요. 재배하는 작물 이름도 함께 말씀해 주세요.",
                  )
                }
              >
                <Volume2 size={18} /> 안내 듣기
              </button>
              <label>
                지역
                <input
                  value={region}
                  maxLength={80}
                  placeholder="예: 전남 나주시"
                  onChange={(e) => setRegion(e.target.value)}
                />
              </label>
              <label>
                작물
                <input
                  value={crop}
                  maxLength={50}
                  placeholder="예: 배, 고추, 벼"
                  onChange={(e) => setCrop(e.target.value)}
                />
              </label>
              <label>
                재배지 이름 <small>선택</small>
                <input
                  value={siteName}
                  maxLength={50}
                  placeholder="예: 집 앞 고추밭"
                  onChange={(e) => setSiteName(e.target.value)}
                />
              </label>
              <button
                className="primary full"
                disabled={busy}
                onClick={() => void saveSite()}
              >
                재배지 등록하기
              </button>
            </div>
          )}
          {["text", "voice", "photo"].includes(modal) && (
            <div className="form">
              <div className="record-context">
                <MapPin size={17} />
                {site?.region} / {site?.crop}
              </div>
              {!editId && (
                <label>
                  작업 날짜
                  <input
                    type="date"
                    disabled={busy || recordingBusy || !!slotsPlan.current}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </label>
              )}
              {modal === "photo" && (
                <PhotoPicker
                  photos={draftPhotos}
                  disabled={busy || recordingBusy || !!slotsPlan.current}
                  onChange={(p) => {
                    setDraftPhotos(p);
                    prepared.current = null;
                  }}
                />
              )}
              {(modal === "voice" || modal === "photo") && (
                <>
                  <p className="hint">
                    작물 이름과 작업 내용을 말씀해 주세요. 비료명과 사용량도
                    함께 알려주세요.
                  </p>
                  <Recorder
                    context={JSON.stringify({
                      region: site?.region,
                      crop: site?.crop,
                      date,
                    })}
                    disabled={busy}
                    onBusy={setRecordingBusy}
                    onResult={(r) => {
                      if (modal === "photo")
                        setVoiceMemo((t) =>
                          [t, r.transcript || r.content]
                            .filter(Boolean)
                            .join("\n"),
                        );
                      else
                        setText((t) =>
                          [t, r.transcript || r.content]
                            .filter(Boolean)
                            .join("\n"),
                        );
                    }}
                  />
                </>
              )}
              {modal === "photo" && voiceMemo && (
                <label>
                  음성 메모
                  <textarea
                    aria-label="음성 메모"
                    rows={4}
                    disabled={busy || recordingBusy}
                    maxLength={6000}
                    value={voiceMemo}
                    onChange={(e) => setVoiceMemo(e.target.value)}
                  />
                </label>
              )}
              <label>
                메모하기
                <textarea
                  rows={6}
                  aria-label="메모하기"
                  disabled={busy || recordingBusy}
                  value={text}
                  maxLength={editId ? 12000 : 6000}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="작업 내용, 비료·농약 이름과 사용량 등을 남겨주세요."
                />
              </label>
              {progress && <p role="status">{progress}</p>}
              {!editId && (
                <p className="hint">
                  오늘의 일기를 누르면 사진·메모를 OpenAI로 정리하여 저장합니다.
                  사진 한 장의 상태를 분석하며 비료의 글자와 수치는 자세히
                  기록합니다.
                </p>
              )}
              <button
                className="primary full"
                disabled={
                  busy ||
                  recordingBusy ||
                  (!text.trim() && !voiceMemo.trim() && !draftPhotos.length)
                }
                onClick={() => void saveRecord()}
              >
                {busy ? (
                  <LoaderCircle className="spin" size={19} />
                ) : (
                  <Check size={19} />
                )}{" "}
                {editId ? "수정 저장" : "오늘의 일기"}
              </button>
            </div>
          )}
          {modal === "post" && (
            <div className="form">
              <p className="hint">
                공개하면 모든 방문자가 글과 사진을 볼 수 있습니다.
              </p>
              <PhotoPicker
                photos={draftPhotos}
                onChange={setDraftPhotos}
                disabled={busy}
              />
              <label>
                나누고 싶은 이야기
                <textarea
                  rows={6}
                  maxLength={2000}
                  value={text}
                  disabled={busy}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="오늘 우리 밭의 이야기를 들려주세요."
                />
              </label>
              <button
                className="primary full"
                disabled={busy || (!text.trim() && !draftPhotos.length)}
                onClick={() =>
                  void action(async () => {
                    await repo.createPost(
                      text.trim() || "사진으로 전하는 농사 소식",
                      site || { id: "", name: "", region: "", crop: "" },
                      nickname,
                      draftPhotos,
                      entryKey.current,
                    );
                    await refreshPosts();
                    setModal(null);
                    setText("");
                    setDraftPhotos([]);
                    setNotice("친구소식에 공개했습니다.");
                  })
                }
              >
                {busy ? "올리고 있습니다" : "공개하기"}
              </button>
            </div>
          )}
        </ModalFrame>
      )}
      {lightbox && (
        <ModalFrame title="우리 밭의 기록" onClose={() => setLightbox(null)}>
          {lightbox.url && (
            <Image
              src={lightbox.url}
              alt={lightbox.description}
              width={1200}
              height={900}
              className="lightbox-image"
              unoptimized
            />
          )}
          <p>{lightbox.description}</p>
        </ModalFrame>
      )}
    </div>
  );
}
