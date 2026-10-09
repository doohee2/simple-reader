import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/supabase";

// Supabase 조회 (Pull)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.email || session?.user?.id;
    if (!session || !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get("fileId");
    
    if (!fileId) {
      return NextResponse.json({ error: "fileId is required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("pdf_metadata")
      .select("*")
      .eq("file_id", fileId)
      .eq("user_id", userId);

    if (error) {
      console.error("Supabase GET Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (error: unknown) {
    console.error("Sync GET Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Supabase 업로드 및 삭제 (Push)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.email || session?.user?.id;
    if (!session || !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { upsertItems, deleteOldBefore } = body;

    // 1. 오래된 휴지통 항목 일괄 삭제 (옵션)
    if (deleteOldBefore) {
      const { error: deleteError } = await supabase
        .from("pdf_metadata")
        .delete()
        .eq("user_id", userId)
        .not("deleted_at", "is", null)
        .lt("deleted_at", deleteOldBefore);

      if (deleteError) {
        console.error("Supabase Delete Old Error:", deleteError);
      }
    }

    // 2. 항목 업서트 (추가 및 수정)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (upsertItems && Array.isArray(upsertItems) && upsertItems.length > 0) {
      // 보안: 클라이언트가 보낸 데이터의 user_id를 강제로 세션의 userId로 덮어씌움
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const safeItems = upsertItems.map((item: any) => ({
        ...item,
        user_id: userId,
      }));

      const { error: upsertError } = await supabase
        .from("pdf_metadata")
        .upsert(safeItems);

      if (upsertError) {
        console.error("Supabase Upsert Error:", upsertError);
        return NextResponse.json({ error: upsertError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Sync POST Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Supabase 일괄 삭제 (Delete All or by fileId)
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.email || session?.user?.id;
    if (!session || !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get("fileId");

    let query = supabase.from("pdf_metadata").delete().eq("user_id", userId);
    
    if (fileId) {
      query = query.eq("file_id", fileId);
    }

    const { error } = await query;
    
    if (error) {
      console.error("Supabase DELETE Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Sync DELETE Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

