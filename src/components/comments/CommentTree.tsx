import { useState } from "preact/hooks";
import CommentForm from "./CommentForm";
import CommentItem from "./CommentItem";
import type { CommentNode } from "./types";

interface Props {
  comments: CommentNode[];
  articleSlug: string;
  userAlias: string;
}

function addToParent(nodes: CommentNode[], parentId: number, newNode: CommentNode): CommentNode[] {
  return nodes.map((node) => {
    if (node.id === parentId) {
      return {
        ...node,
        children: [...node.children, newNode],
      };
    }
    if (node.children.length > 0) {
      return {
        ...node,
        children: addToParent(node.children, parentId, newNode),
      };
    }
    return node;
  });
}

export default function CommentTree({ comments: initialComments, articleSlug }: Props) {
  const [comments, setComments] = useState<CommentNode[]>(initialComments);
  const [collapsedIds, setCollapsedIds] = useState<Set<number>>(new Set());
  const [activeReplyId, setActiveReplyId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleCollapse = (id: number) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const openReplyForm = (id: number | null) => {
    setActiveReplyId(id);
  };

  const submitComment = async (message: string, parentId: number | null) => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/comments/create", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          articleSlug,
          replyBody: message,
          parentId: String(parentId ?? 0),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const newNode: CommentNode = {
          ...data.comment,
          children: [],
        };

        if (parentId === null) {
          setComments((prev) => [newNode, ...prev]);
        } else {
          setComments((prev) => addToParent(prev, parentId, newNode));
        }
        setActiveReplyId(null);
      } else {
        const errorData = await res.json();
        alert(errorData.error || "Failed to post comment");
      }
    } catch (err) {
      console.error("Failed to submit comment:", err);
      alert("Failed to post comment. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <CommentForm onSubmit={(msg) => submitComment(msg, null)} isSubmitting={isSubmitting} />
      <div class="divider"></div>
      {comments.length === 0 ? (
        <p class="text-base-content/50 py-4 text-center italic">No comments yet. Be the first!</p>
      ) : (
        comments.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            depth={0}
            collapsedIds={collapsedIds}
            activeReplyId={activeReplyId}
            onToggleCollapse={toggleCollapse}
            onOpenReply={openReplyForm}
            onSubmitReply={(msg, pid) => submitComment(msg, pid)}
            isSubmitting={isSubmitting}
          />
        ))
      )}
    </div>
  );
}
