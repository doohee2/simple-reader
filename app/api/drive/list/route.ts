import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { z } from "zod";

const DriveListQuerySchema = z.object({
  folderId: z.string().trim().min(1).default("root"),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    // @ts-expect-error - NextAuth 타입이 정확히 매칭되지 않는 문제 우회
    const accessToken = session?.accessToken;

    if (!session || !accessToken) {
      return NextResponse.json({ error: "요청을 처리할 수 없습니다." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const parsedQuery = DriveListQuerySchema.safeParse({
      folderId: searchParams.get("folderId") || undefined,
    });

    if (!parsedQuery.success) {
      return NextResponse.json({ error: "요청을 처리할 수 없습니다." }, { status: 400 });
    }

    const { folderId } = parsedQuery.data;

    const query = `'${folderId}' in parents and (mimeType='application/vnd.google-apps.folder' or mimeType='application/pdf') and trashed=false`;
    const fields = "files(id, name, modifiedTime, size, mimeType)";
    
    const driveApiUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}&orderBy=folder,modifiedTime desc`;

    const response = await fetch(driveApiUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Google Drive API list failed:", response.status, errorText);
      return NextResponse.json(
        { error: "요청을 처리할 수 없습니다." },
        { status: response.status >= 400 && response.status < 500 ? response.status : 500 }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error listing drive files:", error);
    return NextResponse.json({ error: "요청을 처리할 수 없습니다." }, { status: 500 });
  }
}
