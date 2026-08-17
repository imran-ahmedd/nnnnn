// ============================================================
// profile.js — অনবোর্ডিং উইজার্ড, ছবি আপলোড, প্রোফাইল/সেটিংস
// ============================================================
import { db, storage } from "./firebase-config.js";
import { doc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";
import { getCurrentUser, refreshCurrentUserDoc, logOut } from "./auth.js";
import { showToast, $, $all, showView } from "./ui.js";

const INTERESTS = [
  "ভ্রমণ", "সিনেমা", "গান", "বই পড়া", "রান্না", "ফটোগ্রাফি",
  "খেলাধুলা", "শিল্পকলা", "গেমিং", "ফিটনেস", "প্রকৃতি", "নাচ",
];

let step = 0;
let draft = { photos: [], interests: [], gender: "", lookingFor: "" };
const TOTAL_STEPS = 4;

export function initProfileOnboarding() {
  renderInterestChips();
  updateProgress();
  $("#ob-next").addEventListener("click", handleNext);
  $("#ob-back").addEventListener("click", handleBack);
  $all(".photo-slot input[type=file]").forEach((input, idx) => {
    input.addEventListener("change", (e) => handlePhotoSelect(e, idx));
  });
  $all("#ob-gender .chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      $all("#ob-gender .chip").forEach((c) => c.classList.remove("selected"));
      chip.classList.add("selected");
      draft.gender = chip.dataset.value;
    });
  });
  $all("#ob-lookingfor .chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      $all("#ob-lookingfor .chip").forEach((c) => c.classList.remove("selected"));
      chip.classList.add("selected");
      draft.lookingFor = chip.dataset.value;
    });
  });
}

function renderInterestChips() {
  const wrap = $("#ob-interests");
  wrap.innerHTML = INTERESTS.map((i) => `<button type="button" class="chip" data-value="${i}">${i}</button>`).join("");
  $all(".chip", wrap).forEach((chip) => {
    chip.addEventListener("click", () => {
      const v = chip.dataset.value;
      if (draft.interests.includes(v)) {
        draft.interests = draft.interests.filter((x) => x !== v);
        chip.classList.remove("selected");
      } else {
        if (draft.interests.length >= 5) { showToast("সর্বোচ্চ ৫টি আগ্রহ বাছাই করুন", "error"); return; }
        draft.interests.push(v);
        chip.classList.add("selected");
      }
    });
  });
}

async function handlePhotoSelect(e, idx) {
  const file = e.target.files[0];
  if (!file) return;
  const slot = e.target.closest(".photo-slot");
  const reader = new FileReader();
  reader.onload = () => {
    let img = slot.querySelector("img");
    if (!img) {
      img = document.createElement("img");
      slot.prepend(img);
    }
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
  draft.photos[idx] = file;
}

function updateProgress() {
  $all("#ob-progress span").forEach((dot, i) => {
    dot.classList.toggle("done", i < step);
    dot.classList.toggle("active", i === step);
  });
  $all("#ob-steps .ob-step").forEach((s, i) => s.classList.toggle("hidden", i !== step));
  $("#ob-back").classList.toggle("hidden", step === 0);
  $("#ob-next").textContent = step === TOTAL_STEPS - 1 ? "প্রোফাইল সম্পন্ন করুন" : "পরবর্তী";
}

function validateStep() {
  if (step === 0) {
    const name = $("#ob-name").value.trim();
    const age = parseInt($("#ob-age").value, 10);
    if (!name) return "আপনার নাম লিখুন";
    if (!age || age < 18 || age > 90) return "বয়স ১৮ বা তার বেশি হতে হবে";
    draft.name = name; draft.age = age;
    draft.bio = $("#ob-bio").value.trim();
  }
  if (step === 1 && !draft.gender) return "আপনার জেন্ডার বাছাই করুন";
  if (step === 2 && !draft.lookingFor) return "আপনি কাকে খুঁজছেন তা বাছাই করুন";
  if (step === 3 && draft.photos.filter(Boolean).length < 1) return "কমপক্ষে ১টি ছবি আপলোড করুন";
  return null;
}

async function handleNext() {
  const err = validateStep();
  if (err) { showToast(err, "error"); return; }
  if (step < TOTAL_STEPS - 1) {
    step++;
    updateProgress();
    return;
  }
  await completeOnboarding();
}

function handleBack() {
  if (step > 0) { step--; updateProgress(); }
}

async function completeOnboarding() {
  const btn = $("#ob-next");
  btn.disabled = true;
  btn.textContent = "সংরক্ষণ হচ্ছে...";
  try {
    const user = getCurrentUser();
    const photoURLs = [];
    for (const file of draft.photos.filter(Boolean)) {
      const path = `profile-photos/${user.uid}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
      const sref = ref(storage, path);
      await uploadBytes(sref, file);
      photoURLs.push(await getDownloadURL(sref));
    }
    const data = {
      displayName: draft.name,
      age: draft.age,
      bio: draft.bio || "",
      gender: draft.gender,
      lookingFor: draft.lookingFor,
      interests: draft.interests,
      photos: photoURLs,
      photoURL: photoURLs[0] || null,
      onboardingComplete: true,
      updatedAt: serverTimestamp(),
    };
    await updateDoc(doc(db, "users", user.uid), data);
    refreshCurrentUserDoc(data);
    showToast("প্রোফাইল তৈরি সম্পন্ন হয়েছে! 🎉", "success");
    document.dispatchEvent(new CustomEvent("onboarding-complete"));
  } catch (e) {
    console.error(e);
    showToast("প্রোফাইল সংরক্ষণে সমস্যা হয়েছে। আবার চেষ্টা করুন।", "error");
  } finally {
    btn.disabled = false;
    updateProgress();
  }
}

// --- নিজের প্রোফাইল ভিউ (ট্যাব) ---
export function renderMyProfile(userDoc) {
  if (!userDoc) return;
  $("#my-avatar").src = userDoc.photoURL || "icons/avatar-placeholder.png";
  $("#my-name").textContent = `${userDoc.displayName || ""}, ${userDoc.age || ""}`;
  $("#my-bio").textContent = userDoc.bio || "এখনো কোনো বায়ো লেখা হয়নি।";
}

export function initProfileTab() {
  $("#btn-logout").addEventListener("click", async () => {
    await logOut();
    showToast("লগআউট হয়েছে");
  });
  $("#btn-edit-profile").addEventListener("click", () => {
    showToast("এডিট ফিচার শীঘ্রই আসছে");
  });
}
