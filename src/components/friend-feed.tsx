"use client";
import { PenLine, Trash2 } from "lucide-react";
import type { Post } from "@/lib/domain";
export function elapsed(value: string) {
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 60000),
  );
  return minutes < 1
    ? "방금 전"
    : minutes < 60
      ? `${minutes}분 전`
      : minutes < 1440
        ? `${Math.floor(minutes / 60)}시간 전`
        : `${Math.floor(minutes / 1440)}일 전`;
}
export default function FriendFeed({
  posts,
  uid,
  onWrite,
  onDelete,
  onMore,
  more,
  busy,
  onPhoto,
}: {
  posts: Post[];
  uid: string;
  onWrite: () => void;
  onDelete: (post: Post) => void;
  onMore: () => void;
  more: boolean;
  busy: boolean;
  onPhoto: (url: string) => void;
}) {
  return (
    <section className="friend-feed" aria-label="친구소식 게시판">
      <div className="section-title">
        <h2>친구소식</h2>
        <button className="primary" onClick={onWrite}>
          <PenLine size={18} /> 글·사진 올리기
        </button>
      </div>
      {posts.map((p) => (
        <article className="panel feed-post" key={p.id}>
          <div className="feed-meta">
            <time dateTime={p.created_at}>{elapsed(p.created_at)}</time>
            {p.user_id === uid && (
              <button
                aria-label="내 소식 삭제"
                disabled={busy}
                onClick={() => onDelete(p)}
              >
                <Trash2 size={18} />
              </button>
            )}
          </div>
          <p>{p.content}</p>
          {!!p.photo_urls?.length && (
            <div className={`feed-images count-${p.photo_urls.length}`}>
              {p.photo_urls.map((url, i) => (
                <button
                  key={url}
                  onClick={() => onPhoto(url)}
                  aria-label={`게시물 사진 ${i + 1} 크게 보기`}
                >
                  <img
                    src={url}
                    alt={`친구소식 사진 ${i + 1}`}
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )}
        </article>
      ))}
      {more && (
        <button className="secondary full" disabled={busy} onClick={onMore}>
          이전 소식 더 보기
        </button>
      )}
      <article className="panel feed-post sample-post">
        <div className="feed-meta">
          <span>샘플 · 자료 속 게시물</span>
          <span>1일 전</span>
        </div>
        <p>배추, 올해도 잘 자라고 있습니다. 기분이 좋습니다.</p>
        <div
          className="sample-crop cabbage"
          role="img"
          aria-label="참고 자료의 배추밭 사진"
        />
      </article>
      <article className="panel feed-post sample-post">
        <div className="feed-meta">
          <span>샘플 · 자료 속 게시물</span>
          <span>3시간 전</span>
        </div>
        <p>찜통더위를 이겨내고 어느덧 가을이 무르익네요.</p>
        <div
          className="sample-crop rice"
          role="img"
          aria-label="참고 자료의 벼 사진"
        />
      </article>
    </section>
  );
}
