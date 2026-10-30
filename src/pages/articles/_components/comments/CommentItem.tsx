import Avatar from "./Avatar";
import CommentForm from "./CommentForm";
import type { CommentNode } from "./types";
import { AUTHOR_ALIAS } from "../../../../lib/comments/author";
import { formatDate } from "../../../../lib/date";

// The strip holds five fracture characters, 900px each; each slip takes one, so a
// thread of comments is not one edge repeated.
const tearSlice = (id: number) => `${-(Math.abs(id * 617) % 5) * 900}px`;

interface CommentItemProps {
  comment: CommentNode;
  depth: number;
  collapsedIds: Set<number>;
  activeReplyId: number | null;
  onToggleCollapse: (id: number) => void;
  onOpenReply: (id: number | null) => void;
  onSubmitReply: (message: string, parentId: number) => Promise<boolean>;
  isSubmitting: boolean;
  formError: { parentId: number | null; message: string } | null;
  onClearError: () => void;
}

// A removed comment keeps its slip; a black stamp takes the message's place.
function CommentContent({ comment }: { comment: CommentNode }) {
  if (comment.hidePublicity || comment.moderationStatus === 3) {
    return (
      <div class="msg gone">
        <span class="stamp stamp-lg stamp-ink">{comment.hidePublicity ? "Removed" : "Hidden"}</span>
      </div>
    );
  }

  return <p class="msg">{comment.message}</p>;
}

export default function CommentItem({
  comment,
  depth,
  collapsedIds,
  activeReplyId,
  onToggleCollapse,
  onOpenReply,
  onSubmitReply,
  isSubmitting,
  formError,
  onClearError,
}: CommentItemProps) {
  const hasChildren = comment.children.length > 0;
  const isCollapsed = collapsedIds.has(comment.id);
  const maxDepth = 3;
  const canReply = depth < maxDepth && !comment.hidePublicity && comment.moderationStatus !== 3;
  const replies = comment.children.length === 1 ? "1 reply" : `${comment.children.length} replies`;

  return (
    <>
      <div class="slip">
        <div class="tear-b" style={{ "--tear-x": tearSlice(comment.id) }}>
          <div class="who">
            <Avatar seed={comment.alias} />
            <b>{comment.alias}</b>
            {comment.alias === AUTHOR_ALIAS && <span class="stamp">Author</span>}
            <i class="leader" />
            <time dateTime={comment.createdAt}>{formatDate(new Date(comment.createdAt))}</time>
          </div>

          <CommentContent comment={comment} />

          {(canReply || hasChildren) && (
            <div class="acts">
              {canReply && (
                <button class="key key-sm" onClick={() => onOpenReply(comment.id)}>
                  Reply
                </button>
              )}
              {hasChildren && (
                <button
                  class="key key-sm"
                  aria-expanded={!isCollapsed}
                  onClick={() => onToggleCollapse(comment.id)}
                >
                  {replies}
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M5 9l7 7 7-7"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2.4"
                      stroke-linecap="square"
                    />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {activeReplyId === comment.id && (
        <CommentForm
          onSubmit={(msg) => onSubmitReply(msg, comment.id)}
          isSubmitting={isSubmitting}
          isReply={true}
          onCancel={() => onOpenReply(null)}
          error={formError?.parentId === comment.id ? formError.message : undefined}
          onMessageChange={onClearError}
        />
      )}

      {hasChildren && !isCollapsed && (
        <div class="replies">
          {comment.children.map((child) => (
            <CommentItem
              key={child.id}
              comment={child}
              depth={depth + 1}
              collapsedIds={collapsedIds}
              activeReplyId={activeReplyId}
              onToggleCollapse={onToggleCollapse}
              onOpenReply={onOpenReply}
              onSubmitReply={onSubmitReply}
              isSubmitting={isSubmitting}
              formError={formError}
              onClearError={onClearError}
            />
          ))}
        </div>
      )}
    </>
  );
}
