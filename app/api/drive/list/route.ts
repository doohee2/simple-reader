import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    // @ts-ignore
    const accessToken = session?.accessToken;

    if (!session || !accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get("folderId") || "root";

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
      return NextResponse.json(
        { error: "Failed to fetch files from Google Drive." },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error listing drive files:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
