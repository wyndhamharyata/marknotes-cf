import Avatar from "./Avatar";
import CommentForm from "./CommentForm";
import type { CommentNode } from "./types";

interface CommentItemProps {
  comment: CommentNode;
  depth: number;
  collapsedIds: Set<number>;
  activeReplyId: number | null;
  onToggleCollapse: (id: number) => void;
  onOpenReply: (id: number | null) => void;
  onSubmitReply: (message: string, parentId: number) => void;
  isSubmitting: boolean;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function CommentContent({ comment }: { comment: CommentNode }) {
  if (comment.hidePublicity) {
    return <p class="italic text-base-content/50">Comment deleted by Admin</p>;
  }

  if (comment.moderationStatus === 3) {
    return (
      <p class="italic text-base-content/50">Comment hidden by Auto Moderation</p>
    );
  }

  return (
    <p class="text-base-content/80 break-words whitespace-pre-wrap text-sm">
      {comment.message}
    </p>
  );
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
}: CommentItemProps) {
  const hasChildren = comment.children.length > 0;
  const isCollapsed = collapsedIds.has(comment.id);
  const maxDepth = 3;
  const canReply =
    depth < maxDepth && !comment.hidePublicity && comment.moderationStatus !== 3;

  // Progressive background darkness based on depth (using accent color)
  const bgClasses = [
    "border border-transparent hover:border-base-content/20 rounded-lg p-3 transition-colors", // depth 0: outline on hover
    "bg-accent/5 rounded-lg p-3", // depth 1
    "bg-accent/10 rounded-lg p-3", // depth 2
    "bg-accent/15 rounded-lg p-3", // depth 3
  ];
  const bgClass = bgClasses[Math.min(depth, 3)];

  return (
    <div class={`py-3 ${bgClass}`}>
      <div class="flex gap-3">
        <div class="flex-shrink-0">
          <Avatar seed={comment.alias} size={40} />
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1 flex-wrap">
            <span class="font-semibold text-sm">{comment.alias}</span>
            <span class="text-xs text-base-content/50">
              {formatDate(comment.createdAt)}
            </span>
            {hasChildren && (
              <button
                class="btn btn-ghost btn-xs hover:btn-primary"
                onClick={() => onToggleCollapse(comment.id)}
                title={isCollapsed ? "Expand replies" : "Collapse replies"}
              >
                {isCollapsed ? "▶" : "▼"} {comment.children.length}{" "}
                {comment.children.length === 1 ? "reply" : "replies"}
              </button>
            )}
          </div>

          <CommentContent comment={comment} />

          {canReply && (
            <button
              class="btn btn-xs btn-ghost mt-2"
              onClick={() => onOpenReply(comment.id)}
            >
              Reply
            </button>
          )}

          {activeReplyId === comment.id && (
            <CommentForm
              onSubmit={(msg) => onSubmitReply(msg, comment.id)}
              isSubmitting={isSubmitting}
              isReply={true}
              onCancel={() => onOpenReply(null)}
            />
          )}
        </div>
      </div>

      {hasChildren && !isCollapsed && (
        <div class="ml-6 mt-2">
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
