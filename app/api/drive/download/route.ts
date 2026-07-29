import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { z } from "zod";

const DriveDownloadQuerySchema = z.object({
  fileId: z.string().trim().min(1),
});

export async function GET(
  request: NextRequest
) {
  try {
    const session = await auth();
    
    // @ts-ignore
    const accessToken = session?.accessToken;

    if (!session || !accessToken) {
      return NextResponse.json(
        { error: "요청을 처리할 수 없습니다." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const parsedQuery = DriveDownloadQuerySchema.safeParse({
      fileId: searchParams.get("fileId") || undefined,
    });

    if (!parsedQuery.success) {
      return NextResponse.json(
        { error: "요청을 처리할 수 없습니다." },
        { status: 400 }
      );
    }

    const { fileId } = parsedQuery.data;

    const driveApiUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

    const response = await fetch(driveApiUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Google Drive API Error:", response.status, errorText);
      return NextResponse.json(
        { error: "요청을 처리할 수 없습니다." },
        { status: response.status >= 400 && response.status < 500 ? response.status : 500 }
      );
    }

    const arrayBuffer = await response.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="document.pdf"`,
      },
    });
  } catch (error: unknown) {
    console.error("Error downloading file:", error);
    return NextResponse.json(
      { error: "요청을 처리할 수 없습니다." },
      { status: 500 }
    );
  }
}
