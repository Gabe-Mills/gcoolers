class Gcoolers < Formula
  desc "Apple Silicon thermal governor by Gabe Mills"
  homepage "https://gcoolers.com"
  url "https://github.com/Gabe-Mills/gcoolers/archive/refs/tags/v3.06.tar.gz"
  sha256 "c43675dc3c9379fb53b1d9f03a19522c6adc86a7e14423eb1ebfb0090c5d6242"
  license "MIT"
  version "3.06"

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
      One-time setup (Mac password once for fans):
        gcool

      Widget: Notification Center → Edit Widgets → Gcoolers
      Site:  https://gcoolers.com
    EOS
  end

  test do
    assert_match "Gcoolers", shell_output("#{bin}/gcoolers version")
  end
end
