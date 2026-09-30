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
  CalendarDays,
  PenLine,
  Upload,
  Check,
  X,
  Settings,
  Download,
  Search,
  Trash2,
  Pin,
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
  photoSlot,
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
import { compressPhoto } from "@/lib/images";
import Recorder from "./recorder";
type View = "home" | "notes" | "resources" | "news" | "community" | "settings";
type Modal = "login" | "site" | "photo" | "voice" | "text" | "post" | null;
const nav = [
  { id: "home", label: "홈", icon: House },
  { id: "notes", label: "나의노트", icon: BookOpen },
  { id: "resources", label: "농사자료", icon: Leaf },
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
    [demo, setDemo] = useState(!configured),
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
    [text, setText] = useState(""),
    [keywords, setKeywords] = useState<string[]>([]);
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [search, setSearch] = useState(""),
    [filterDate, setFilterDate] = useState(""),
    [editId, setEditId] = useState("");
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null),
    [photoUrl, setPhotoUrl] = useState(""),
    [score, setScore] = useState(60),
    [changed, setChanged] = useState(true),
    [analyzed, setAnalyzed] = useState(false),
    [lightbox, setLightbox] = useState<Photo | null>(null);
  const inputRef = useRef<HTMLInputElement>(null),
    cameraRef = useRef<HTMLInputElement>(null),
    entryKey = useRef(crypto.randomUUID());
  const site = sites.find((s) => s.id === siteId) || sites[0];
  const currentNote = notes.find((n) => n.id === selectedNote);
  const dayNote = notes.find(
    (n) => n.site_id === site?.id && n.note_date === todayKST(),
  );
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
    if (!photoBlob) {
      setPhotoUrl("");
      return;
    }
    const url = URL.createObjectURL(photoBlob);
    setPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photoBlob]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6500);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    function warn(e: BeforeUnloadEvent) {
      if (
        busy ||
        ((modal === "text" || modal === "voice" || modal === "photo") && text)
      ) {
        e.preventDefault();
      }
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy, modal, text]);
  async function refresh() {
    if (!demo) {
      const data = await repo.loadData();
      setSites(data.sites);
      setNotes(data.notes);
    }
  }
  function go(v: View) {
    setView(v);
    setSelectedNote(null);
    setSearch("");
    setError("");
    if (v === "community" && logged && !demo)
      void repo
        .loadPosts()
        .then(setPosts)
        .catch((e) => setError(readableError(e)));
  }
  function open(m: Modal) {
    setError("");
    setText("");
    setKeywords([]);
    setEditId("");
    setPhotoBlob(null);
    setAnalyzed(false);
    setDate(todayKST());
    entryKey.current = crypto.randomUUID();
    if (!logged && m !== "login") {
      setModal("login");
      return;
    }
    if (!site && ["photo", "voice", "text", "post"].includes(m || "")) {
      setModal("site");
      return;
    }
    setModal(m);
  }
  function close() {
    if (busy) return;
    if (
      text &&
      !window.confirm(
        "작성 중인 내용을 닫을까요? 저장하지 않은 내용은 사라집니다.",
      )
    )
      return;
    setModal(null);
    setText("");
    setPhotoBlob(null);
  }
  async function action(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await task();
    } catch (e) {
      setError(readableError(e));
    } finally {
      setBusy(false);
    }
  }
  async function login() {
    if (!validPhone(phone)) {
      setError("휴대전화 번호를 확인해 주세요.");
      return;
    }
    await action(async () => {
      if (!demo) {
        let {
          data: { session },
        } = await supabase!.auth.getSession();
        if (!session) {
          const result = await supabase!.auth.signInAnonymously();
          if (result.error)
            throw new Error(
              "베타 로그인이 준비되지 않았습니다. Supabase에서 익명 로그인을 활성화해 주세요.",
            );
          session = result.data.session;
        }
        if (!session) throw new Error("로그인하지 못했습니다.");
        const { error } = await supabase!
          .from("profiles")
          .upsert({
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
      setModal(sites.length ? null : "site");
    });
  }
  async function saveSite() {
    if (!region.trim() || !crop.trim()) {
      setError("지역과 작물 이름을 입력해 주세요.");
      return;
    }
    await action(async () => {
      const newSite = demo
        ? {
            id: crypto.randomUUID(),
            region: region.trim(),
            crop: crop.trim(),
            name: siteName.trim() || `${crop.trim()} 재배지`,
          }
        : await repo.addSite({
            region: region.trim(),
            crop: crop.trim(),
            name: siteName.trim() || `${crop.trim()} 재배지`,
          });
      setSites((s) => [...s, newSite]);
      setSiteId(newSite.id);
      setModal(null);
      setRegion("");
      setCrop("");
      setSiteName("");
      setNotice("재배지를 등록했습니다. 오늘의 농사를 기록해 보세요.");
    });
  }
  async function saveRecord() {
    if (!site || !text.trim()) {
      setError("기록할 내용을 입력해 주세요.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError("작업 날짜를 선택해 주세요.");
      return;
    }
    await action(async () => {
      if (editId) {
        if (demo)
          setNotes((ns) =>
            ns.map((n) => ({
              ...n,
              entries: n.entries.map((e) =>
                e.id === editId ? { ...e, content: text.trim() } : e,
              ),
            })),
          );
        else {
          await repo.editEntry(editId, text.trim());
          await refresh();
        }
      } else {
        const kind =
          modal === "photo" ? "photo" : modal === "voice" ? "voice" : "text";
        let note = notes.find(
          (n) => n.site_id === site.id && n.note_date === date,
        );
        if (!note)
          note = demo
            ? {
                id: crypto.randomUUID(),
                site_id: site.id,
                note_date: date,
                region: site.region,
                crop: site.crop,
                entries: [],
                photos: [],
              }
            : await repo.ensureNote(site, date);
        const entry: Entry = {
          id: entryKey.current,
          note_id: note.id,
          kind,
          content: text.trim(),
          keywords,
          created_at: new Date().toISOString(),
        };
        if (demo) {
          const next = {
            ...note,
            entries: [
              ...(note.entries || []).filter((e) => e.id !== entry.id),
              entry,
            ],
            photos: note.photos || [],
          };
          if (kind === "photo" && photoBlob) {
            const slot = photoSlot(next.photos, score, changed);
            if (slot) {
              const url = URL.createObjectURL(photoBlob);
              next.photos = [
                ...next.photos.filter((p) => p.slot !== slot),
                {
                  note_id: note.id,
                  slot,
                  path: "",
                  score,
                  description: text,
                  pinned: false,
                  url,
                },
              ];
            }
          }
          setNotes((ns) =>
            [...ns.filter((n) => n.id !== next.id), next].sort((a, b) =>
              b.note_date.localeCompare(a.note_date),
            ),
          );
        } else {
          await repo.saveEntry(note.id, kind, text.trim(), keywords, entry.id);
          if (kind === "photo" && photoBlob) {
            const fresh = await repo.loadData();
            const existing = fresh.notes.find((n) => n.id === note!.id);
            const slot = photoSlot(existing?.photos || [], score, changed);
            if (slot)
              await repo.savePhoto(
                note.id,
                slot,
                photoBlob,
                score,
                text.trim(),
              );
          }
          await refresh();
        }
        setSelectedNote(note.id);
        setView("notes");
      }
      setModal(null);
      setText("");
      setPhotoBlob(null);
      setNotice(
        demo
          ? "체험 기록을 남겼습니다. 새로고침하면 초기화됩니다."
          : "나의노트에 저장했습니다.",
      );
    });
  }
  async function selectPhoto(file?: File) {
    if (!file) return;
    await action(async () => {
      setPhotoBlob(await compressPhoto(file));
      setScore(60);
      setChanged(true);
      setAnalyzed(false);
      setText("");
    });
  }
  async function analyzePhoto() {
    if (!photoBlob) return;
    if (demo) {
      setError(
        "체험 모드에서는 AI를 호출하지 않습니다. 사진 설명을 직접 입력해 보세요.",
      );
      return;
    }
    await action(async () => {
      const form = new FormData();
      form.set("kind", "photo");
      form.set("file", photoBlob, "photo.jpg");
      form.set(
        "context",
        JSON.stringify({
          region: site?.region,
          crop: site?.crop,
          date,
          previous:
            notes
              .find((n) => n.site_id === site?.id && n.note_date === date)
              ?.photos.map((p) => p.description) || [],
        }),
      );
      const result = await repo.runAI(form);
      setText(result.content);
      setKeywords(result.keywords);
      setScore(result.score);
      setChanged(result.changed);
      setAnalyzed(true);
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
      if (demo)
        setNotes((ns) =>
          ns.map((n) => ({
            ...n,
            entries: n.entries.filter((e) => e.id !== entry.id),
          })),
        );
      else {
        await repo.deleteEntry(entry.id);
        await refresh();
      }
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
          <span>
            K영농일지<small>농사의 하루를 담다</small>
          </span>
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
          <span className="beta-label">BETA 0.1</span>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="mobile-brand">
            <Sprout /> K영농일지
          </div>
          <div className="desktop-breadcrumb">
            나의 농사 생활 <ChevronRight size={14} />{" "}
            <strong>
              {
                {
                  home: "홈",
                  notes: "나의노트",
                  resources: "농사자료",
                  news: "농업뉴스",
                  community: "친구 소식",
                  settings: "설정",
                }[view]
              }
            </strong>
          </div>
          <div className="top-actions">
            <span className={`connection ${demo ? "demo" : ""}`}>
              <span />
              {demo ? "체험 모드" : "베타 서비스"}
            </span>
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
          <div className="page-top">
            <div>
              <p className="eyebrow">
                {view === "home" ? "MY FARM, MY DAY" : "K FARM LOG"}
              </p>
              <h1>
                {
                  {
                    home: "오늘도, 수고하셨습니다 🌱",
                    notes: "나의노트",
                    resources: "알아두면 든든한 농사자료",
                    news: "농업뉴스",
                    community: "함께 나누는 농사 이야기",
                    settings: "설정 및 도움말",
                  }[view]
                }
              </h1>
              <p className="page-description">
                {
                  {
                    home: "사진 한 장, 목소리 한마디로 오늘의 농사를 남겨보세요.",
                    notes: "차곡차곡 쌓이는 우리 밭의 이야기",
                    resources: "믿을 수 있는 공식 자료를 한곳에서 확인하세요.",
                    news: "농업 현장의 소식, 공식 출처에서 확인하세요.",
                    community: "나만의 경험이 이웃에게는 좋은 배움이 됩니다.",
                    settings: "내 재배지와 기록을 관리하세요.",
                  }[view]
                }
              </p>
            </div>
            <div className="date-pill">
              <CalendarDays size={17} />
              {formatDate(todayKST())}
            </div>
          </div>
          {demo && (
            <div className="demo-banner">
              <ShieldCheck size={18} />
              <span>
                체험 화면입니다. 기록은 서버에 저장되지 않으며 새로고침하면
                초기화됩니다.
              </span>
            </div>
          )}
          {error && !modal && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          {site && (
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
              <section className="hero">
                <div className="hero-copy">
                  <span className="hero-tag">
                    <span /> 나의 영농 파트너
                  </span>
                  <h2>
                    농사는 정성으로,
                    <br />
                    기록은 간편하게.
                  </h2>
                  <p>
                    흙 묻은 손으로 길게 쓰지 않아도 괜찮아요.
                    <br />
                    오늘의 작물과 작업을 사진으로 남겨주세요.
                  </p>
                  <button className="primary" onClick={() => open("photo")}>
                    <Camera size={21} /> 사진 찍기{" "}
                    <ArrowUpRight size={18} />
                  </button>
                </div>
              </section>
              <section className="quick-actions" aria-label="기록 방법">
                <button className="action-card" onClick={() => open("voice")}>
                  <span className="action-icon mint">
                    <Mic size={28} />
                  </span>
                  <span>
                    <strong>음성으로 기록하기</strong>
                    <small>오늘 한 일을 목소리로 간편하게</small>
                  </span>
                  <ChevronRight />
                </button>
                <button className="action-card" onClick={() => open("text")}>
                  <span className="action-icon peach">
                    <PenLine size={27} />
                  </span>
                  <span>
                    <strong>글로 기록하기</strong>
                    <small>잊기 전에 짧게 남기는 메모</small>
                  </span>
                  <ChevronRight />
                </button>
                <button className="action-card" onClick={() => go("notes")}>
                  <span className="action-icon lavender">
                    <BookOpen size={27} />
                  </span>
                  <span>
                    <strong>나의노트 보기</strong>
                    <small>날짜별로 모아보는 농사 기록</small>
                  </span>
                  <ChevronRight />
                </button>
              </section>
              <div className="home-grid">
                <section className="panel today-panel">
                  <div className="section-title">
                    <h2>
                      오늘의 기록{" "}
                      <span className="count">
                        {dayNote?.entries.length || 0}
                      </span>
                    </h2>
                    <button className="text-button" onClick={() => go("notes")}>
                      전체 보기 <ChevronRight size={16} />
                    </button>
                  </div>
                  {dayNote?.entries.length ? (
                    <>
                      <div className="mini-photos">
                        {dayNote.photos.map((p) => (
                          <button key={p.slot} onClick={() => setLightbox(p)}>
                            {p.url && (
                              <Image
                                src={p.url}
                                alt={p.description}
                                width={160}
                                height={110}
                                unoptimized
                              />
                            )}
                          </button>
                        ))}
                      </div>
                      {dayNote.entries.slice(-2).map((e) => (
                        <div className="recent-entry" key={e.id}>
                          <span className="entry-dot" />
                          <div>
                            <small>
                              {e.kind === "voice"
                                ? "음성 기록"
                                : e.kind === "photo"
                                  ? "사진 기록"
                                  : "작업 메모"}
                            </small>
                            <p>{e.content}</p>
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="empty-state">
                      <span className="empty-icon">
                        <Sprout size={35} />
                      </span>
                      <h3>오늘 우리 밭은 어땠나요?</h3>
                      <p>
                        작은 변화도 소중한 기록이 됩니다.
                        <br />첫 번째 기록을 남겨보세요.
                      </p>
                      <button
                        className="secondary"
                        onClick={() => open("text")}
                      >
                        <Plus size={17} /> 오늘 기록 남기기
                      </button>
                    </div>
                  )}
                </section>
                <section className="guide-panel">
                  <span className="guide-label">기록이 쉬워지는 작은 팁</span>
                  <div className="guide-icon">
                    <Mic size={28} />
                    <span>“</span>
                  </div>
                  <h2>이렇게 말씀해 보세요</h2>
                  <blockquote>
                    “오늘 고추밭에 물을 주고,
                    <br />
                    복합비료 2kg을 뿌렸어.”
                  </blockquote>
                  <p>
                    지역, 작물, 작업 내용을 말씀해 주세요.
                    <br />
                    비료·농약 이름과 사용량도 함께 남겨요.
                  </p>
                  <button
                    className="text-button"
                    onClick={() => {
                      speak(
                        "작물 이름과 오늘 한 일을 말씀해 주세요. 비료나 농약을 사용하셨다면 이름과 사용량도 알려 주세요. 다른 날의 기록이면 날짜도 말씀해 주세요.",
                      );
                    }}
                  >
                    <Volume2 size={17} /> 안내 듣기
                  </button>
                </section>
              </div>
              <section className="resource-shortcuts">
                <button onClick={() => go("resources")}>
                  <span className="resource-icon">
                    <Leaf />
                  </span>
                  <span>
                    <strong>비료·병해충 자료</strong>
                    <small>우리 작물에 필요한 정보 찾기</small>
                  </span>
                  <ArrowUpRight />
                </button>
                <button onClick={() => go("news")}>
                  <span className="resource-icon news">
                    <Newspaper />
                  </span>
                  <span>
                    <strong>농업뉴스</strong>
                    <small>알아두면 좋은 새로운 농업 소식</small>
                  </span>
                  <ArrowUpRight />
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
                <h2>
                  {currentNote.region} / {currentNote.crop}
                </h2>
                <time>{formatDate(currentNote.note_date)}</time>
              </div>
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
                        className={`pin ${p.pinned ? "selected" : ""}`}
                        aria-label={
                          p.pinned ? "대표 사진 고정 해제" : "대표 사진 고정"
                        }
                        onClick={() =>
                          void action(async () => {
                            if (demo)
                              setNotes((ns) =>
                                ns.map((n) => ({
                                  ...n,
                                  photos: n.photos.map((q) =>
                                    q.note_id === p.note_id && q.slot === p.slot
                                      ? { ...q, pinned: !q.pinned }
                                      : q,
                                  ),
                                })),
                              );
                            else {
                              await repo.pinPhoto(p);
                              await refresh();
                            }
                          })
                        }
                      >
                        <Pin size={16} />
                        {p.pinned ? "고정됨" : "고정"}
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
              <p className="hint">
                하루 대표 사진 최대 3장 · 고정한 사진은 자동 교체되지 않습니다.
              </p>
              {(["text", "voice", "photo"] as const).map((kind) => (
                <div className="entry-section" key={kind}>
                  <h3>
                    {kind === "text"
                      ? "오늘의 영농작업"
                      : kind === "voice"
                        ? "음성으로 남긴 기록"
                        : "사진에서 읽은 내용"}
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
                베타에서는 공식 자료실 링크를 제공합니다. 실시간 기사 수집과
                병해충 자동 진단은 제공하지 않습니다.
              </p>
            </>
          )}
          {view === "community" && (
            <>
              <div className="community-intro">
                <div>
                  <h2>우리의 농사 경험을 나눠요</h2>
                  <p>
                    나의노트는 비공개입니다. 직접 올린 글만 이곳에 공개됩니다.
                  </p>
                </div>
                <button className="primary" onClick={() => open("post")}>
                  <PenLine size={18} /> 소식 쓰기
                </button>
              </div>
              {posts.length ? (
                posts.map((p) => (
                  <article className="panel post" key={p.id}>
                    <div className="post-author">
                      <span className="avatar">
                        <Sprout />
                      </span>
                      <div>
                        <strong>{p.nickname}</strong>
                        <small>
                          {p.region} · {p.crop} ·{" "}
                          {formatDate(p.created_at.slice(0, 10))}
                        </small>
                      </div>
                      {p.user_id === uid && (
                        <button
                          aria-label="내 소식 삭제"
                          className="icon-button"
                          onClick={() => {
                            if (confirm("공개한 소식을 삭제할까요?"))
                              void action(async () => {
                                if (!demo) await repo.removePost(p.id);
                                setPosts((ps) =>
                                  ps.filter((q) => q.id !== p.id),
                                );
                              });
                          }}
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                    <p>{p.content}</p>
                  </article>
                ))
              ) : (
                <div className="panel empty-state">
                  <Users size={45} />
                  <h3>첫 번째 농사 이야기를 기다려요</h3>
                  <p>오늘의 발견이나 작업 경험을 이웃에게 들려주세요.</p>
                </div>
              )}
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
                    <strong>사진은 365일, 음성은 보관하지 않아요</strong>
                    <small>음성은 핵심 내용만 문자로 남깁니다.</small>
                  </span>
                </div>
                <p className="hint">
                  베타 계정은 이 기기의 로그인 정보와 연결됩니다. 브라우저
                  데이터를 지우거나 다른 기기를 사용하면 기존 기록에 접근할 수
                  없습니다. 중요한 기록은 내려받아 보관해 주세요.
                </p>
                {logged && (
                  <button
                    className="text-button"
                    onClick={() => {
                      if (
                        confirm(
                          "로그아웃하면 베타 계정에 다시 접근하지 못할 수 있습니다. 기록을 내려받으셨나요?",
                        )
                      )
                        void action(async () => {
                          if (!demo) await supabase!.auth.signOut();
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
                  전화번호는 베타 회원 식별을 위해 사용합니다. 내 노트는
                  공개되지 않으며 AI 정리를 선택한 사진·음성·메모만 OpenAI로
                  전송합니다.
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
              photo: "사진으로 기록하기",
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
                {demo
                  ? "체험 중에는 입력한 전화번호를 전송하거나 저장하지 않습니다."
                  : "문자 인증 없는 베타입니다. 이 기기의 로그인으로만 내 기록에 접근할 수 있습니다."}
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
                {demo ? "체험 시작하기" : "동의하고 시작하기"}
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
              {!demo && (
                <Recorder
                  context="지역과 작물 이름을 등록하는 단계입니다."
                  onResult={(r) => {
                    if (r.region) setRegion(r.region);
                    if (r.crop) setCrop(r.crop);
                  }}
                />
              )}
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
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </label>
              )}
              {modal === "voice" && (
                <>
                  <div className="voice-guide">
                    <p>
                      먼저 <strong>작물 이름</strong>을 말씀해 주세요.
                      <br />
                      다른 날의 기록이면 <strong>날짜</strong>도 함께
                      알려주세요.
                    </p>
                    <button
                      className="text-button"
                      onClick={() =>
                        speak(
                          "작물 이름과 오늘 하신 일을 말씀해 주세요. 다른 날의 기록이면 날짜도 알려 주세요. 비료와 농약 이름, 사용량은 꼭 말씀해 주세요.",
                        )
                      }
                    >
                      <Volume2 size={18} /> 안내 듣기
                    </button>
                  </div>
                  {demo ? (
                    <div className="info-banner">
                      체험 모드에서는 음성을 전송하지 않습니다. 아래에 직접
                      입력해 보세요.
                    </div>
                  ) : (
                    <Recorder
                      context={JSON.stringify({
                        region: site?.region,
                        crop: site?.crop,
                        date,
                      })}
                      onResult={(r) => {
                        setText(r.content);
                        setKeywords(r.keywords);
                        if (/^\d{4}-\d{2}-\d{2}$/.test(r.date)) setDate(r.date);
                        if (r.crop && r.crop !== site?.crop)
                          setError(
                            `말씀하신 작물은 '${r.crop}'입니다. 현재 '${site?.crop}' 노트에 기록됩니다. 다른 작물이면 재배지를 바꿔 주세요.`,
                          );
                      }}
                    />
                  )}
                </>
              )}
              {modal === "photo" && (
                <>
                  <input
                    hidden
                    ref={inputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => void selectPhoto(e.target.files?.[0])}
                  />
                  <input
                    hidden
                    ref={cameraRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => void selectPhoto(e.target.files?.[0])}
                  />
                  <div className="photo-inputs">
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() => cameraRef.current?.click()}
                    >
                      <Camera size={22} /> 사진 찍기
                    </button>
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() => inputRef.current?.click()}
                    >
                      <Upload size={22} /> 사진 올리기
                    </button>
                  </div>
                  {photoUrl ? (
                    <div className="photo-preview">
                      <Image
                        src={photoUrl}
                        alt="선택한 사진 미리보기"
                        width={600}
                        height={400}
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div className="upload-placeholder">
                      <ImagePlus size={44} />
                      <p>오늘의 작물이나 작업 사진을 선택하세요.</p>
                    </div>
                  )}
                  <button
                    className="secondary full"
                    disabled={!photoBlob || busy}
                    onClick={() => void analyzePhoto()}
                  >
                    {busy ? (
                      <LoaderCircle className="spin" size={20} />
                    ) : (
                      <Sprout size={20} />
                    )}
                    사진에서 글자와 변화 읽기
                  </button>
                  {analyzed && (
                    <p className="hint">
                      {score < 35
                        ? "사진이 흐려 텍스트만 저장됩니다."
                        : !changed
                          ? "주요 변화가 없어 기존 대표 사진을 우선 유지합니다."
                          : "AI가 정리한 내용을 확인하고 수정해 주세요."}
                    </p>
                  )}
                  <p className="hint">
                    대표 사진은 하루 최대 3장입니다. 그 외 사진은 텍스트만
                    남기며 사진 파일을 보관하지 않습니다.
                  </p>
                </>
              )}
              <label>
                {modal === "voice"
                  ? "핵심 기록 확인"
                  : modal === "photo"
                    ? "사진 내용 · 직접 입력도 가능"
                    : "오늘의 영농작업"}
                <textarea
                  rows={6}
                  value={text}
                  maxLength={12000}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="작업 내용, 비료·농약 이름과 사용량 등을 남겨주세요."
                />
              </label>
              <button
                className="primary full"
                disabled={
                  busy || !text.trim() || (modal === "photo" && !photoBlob)
                }
                onClick={() => void saveRecord()}
              >
                {busy ? (
                  <LoaderCircle className="spin" size={19} />
                ) : (
                  <Check size={19} />
                )}{" "}
                {demo ? "체험 노트에 남기기" : "나의노트에 저장하기"}
              </button>
            </div>
          )}
          {modal === "post" && (
            <div className="form">
              <p>
                이 글은 로그인한 다른 농부에게 공개됩니다. 전화번호나 개인
                정보는 적지 마세요.
              </p>
              <label>
                나누고 싶은 이야기
                <textarea
                  rows={7}
                  value={text}
                  maxLength={2000}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="오늘 우리 밭에서 발견한 이야기를 들려주세요."
                />
              </label>
              <button
                className="primary full"
                disabled={busy || !text.trim()}
                onClick={() =>
                  void action(async () => {
                    if (!site) return;
                    if (demo)
                      setPosts((ps) => [
                        {
                          id: crypto.randomUUID(),
                          user_id: uid,
                          nickname,
                          region: site.region,
                          crop: site.crop,
                          content: text.trim(),
                          created_at: new Date().toISOString(),
                        },
                        ...ps,
                      ]);
                    else {
                      await repo.createPost(text.trim(), site, nickname);
                      setPosts(await repo.loadPosts());
                    }
                    setModal(null);
                    setText("");
                    setNotice(
                      demo
                        ? "체험 소식을 작성했습니다. 외부에 공개되지 않습니다."
                        : "친구 소식에 글을 올렸습니다.",
                    );
                  })
                }
              >
                {demo ? "체험 소식 올리기" : "공개하고 소식 올리기"}
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
