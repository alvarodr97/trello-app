"use server";

import { auth } from "@clerk/nextjs";
import { InputType, ReturnType } from "./types";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { createSafeAction } from "@/lib/create-safe-action";
import { CopyList } from "./schema";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = auth();

  if (!userId || !orgId) {
    return {
      error: "Unauthorized",
    };
  }

  const { id, boardId } = data;
  let list;

  try {
    const listToCopy = await db.list.findUnique({
      where: {
        id,
        boardId,
        board: {
          orgId,
        },
      },
      include: {
        cards: true,
      },
    });

    console.log("list a copiar", listToCopy);

    if (!listToCopy) {
      return { error: "List not found" };
    }

    const lastList = await db.list.findFirst({
      where: { boardId },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    console.log("lastList", lastList);

    const newOrder = lastList ? lastList.order + 1 : 1;

    if (listToCopy.cards.length === 0) {
      list = await db.list.create({
        data: {
          title: `${listToCopy.title} - copy`,
          boardId: listToCopy.boardId,
          order: newOrder,
        },
      });
    } else {
      list = await db.list.create({
        data: {
          title: `${listToCopy.title} - copy`,
          boardId: listToCopy.boardId,
          order: newOrder,
          cards: {
            createMany: {
              data: listToCopy?.cards.map((card) => ({
                title: card.title,
                description: card.description,
                order: card.order,
              })),
            },
          },
        },
        include: {
          cards: true,
        },
      });
    }

    console.log("list", list);
  } catch (error) {
    return {
      error: "Failed to copy list",
    };
  }

  revalidatePath(`/board/${boardId}`);
  return { data: list };
};

export const copyList = createSafeAction(CopyList, handler);
