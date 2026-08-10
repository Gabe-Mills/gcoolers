class Gcoolers < Formula
  desc "Apple Silicon thermal governor by Gabe Mills"
  homepage "https://gcoolers.com"
  url "https://github.com/Gabe-Mills/gcoolers/archive/refs/tags/v3.0.0.tar.gz"
  sha256 "REPLACE_AFTER_RELEASE"
  license "MIT"
  version "3.0.0"

  depends_on :macos
  depends_on arch: :arm64
  depends_on "python@3.12"

  def install
    system ENV.cc, "-O2", "-o", "heatwatch-fan", "Tools/heatwatch-fan.c",
           "-framework", "IOKit", "-framework", "CoreFoundation"

    bin.install "bin/gcoolers"
    bin.install "heatwatch-fan"
    bin.install "vendor/darwin-arm64/macmon" if File.exist?("vendor/darwin-arm64/macmon")
    bin.install_symlink "gcoolers" => "gcool"

    (share/"gcoolers").mkpath
    (share/"gcoolers").install "Sources"
    (share/"gcoolers").install "Tools"
    (share/"gcoolers").install "scripts" if File.directory?("scripts")
  end

  def caveats
    <<~EOS
      First-time setup (password once for fan helper):
        gcoolers install
        gcoolers doctor

      Add the widget: Notification Center or desktop → Edit Widgets → Gcoolers

      Website: https://gcoolers.com
    EOS
  end

  test do
    assert_match "Gcoolers", shell_output("#{bin}/gcoolers version")
  end
end
