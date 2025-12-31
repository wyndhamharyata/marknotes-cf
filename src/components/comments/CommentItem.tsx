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
    return <p class="text-base-content/50 italic">Comment deleted by Admin</p>;
  }

  if (comment.moderationStatus === 3) {
    return <p class="text-base-content/50 italic">Comment hidden by Auto Moderation</p>;
  }

  return (
    <p class="text-base-content/80 text-sm break-words whitespace-pre-wrap">{comment.message}</p>
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
  const canReply = depth < maxDepth && !comment.hidePublicity && comment.moderationStatus !== 3;

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
        <div class="min-w-0 flex-1">
          <div class="mb-1 flex flex-wrap items-center gap-2">
            <span class="text-sm font-semibold">{comment.alias}</span>
            <span class="text-base-content/50 text-xs">{formatDate(comment.createdAt)}</span>
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
            <button class="btn btn-xs btn-ghost mt-2" onClick={() => onOpenReply(comment.id)}>
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
        <div class="mt-2 ml-6">
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
