class OpencodeOrchestrator < Formula
  include Language::Python::Virtualenv

  desc "Automated OpenCode task orchestrator with Telegram integration"
  homepage "https://github.com/opencode-ai/opencode-orchestrator"
  url "https://github.com/opencode-ai/opencode-orchestrator/archive/v0.1.0.tar.gz"
  sha256 "PLACEHOLDER_SHA256"
  license "MIT"

  depends_on "python@3.12"
  depends_on "opencode" => :recommended

  resource "click" do
    url "https://files.pythonhosted.org/packages/96/d3/f04c7bfcf5c1862a2a5b845c6b2b360488cf47af55dfa79c98f6a6bf98b5/click-8.1.7.tar.gz"
    sha256 "ca9853ad459e787e2192211578cc907e7594e294c7ccc834310722b41b9ca6de"
  end

  resource "rich" do
    url "https://files.pythonhosted.org/packages/a1/77/62dc70bd47ca961b805a9bbd42be422fe4bd5069e2d9ee50d322a5a6c8a8/rich-13.7.1.tar.gz"
    sha256 "9be308cb1fe2f1f57d67ce99e95b602253334f7deee3e16c1c52eed606e6df56"
  end

  resource "pydantic" do
    url "https://files.pythonhosted.org/packages/df/e4/ba44652d562cbf071bf69c8973ef574941cb8033a71fa507fb0d1ad2c2a8/pydantic-2.6.4.tar.gz"
    sha256 "b1704e0847db01817624a6b86766967f552dd9dbf3afba4004409f908dcc84e6"
  end

  resource "langgraph" do
    url "https://files.pythonhosted.org/packages/PLACEHOLDER/langgraph-0.0.50.tar.gz"
    sha256 "PLACEHOLDER"
  end

  resource "langchain-core" do
    url "https://files.pythonhosted.org/packages/PLACEHOLDER/langchain-core-0.1.0.tar.gz"
    sha256 "PLACEHOLDER"
  end

  resource "python-telegram-bot" do
    url "https://files.pythonhosted.org/packages/9a/bb/3471cc80c2bde1ea05d33530465262d58f9c8c4a10dd8bf3a8c574c60978/python-telegram-bot-20.7.tar.gz"
    sha256 "8b75cf9e543e80b9a7c3cb4ecef6f1f87a1d52799d97ad30d4e7a466183cf051"
  end

  resource "pyyaml" do
    url "https://files.pythonhosted.org/packages/cd/e5/af35f7ea75cf38f451bd1381f87b2ac865f3ea3408b5462a72f3a003a1ee/PyYAML-6.0.1.tar.gz"
    sha256 "bfdf460b1736c775f2ba9f6a92bca30bc2095067b8a9d77876d1fad6cc3b4a43"
  end

  resource "aiofiles" do
    url "https://files.pythonhosted.org/packages/af/41/cfed10bc64d774f497a86e91ee665f6d6482b6d6079783e1697b79199fc6/aiofiles-23.2.1.tar.gz"
    sha256 "84ec2218d8419404abcb9f0c02df3f34c6e0a68ed41072acfb1cef5cbc29051a"
  end

  resource "psutil" do
    url "https://files.pythonhosted.org/packages/90/c7/6dc0a455d111f2ee81f4dbc86a5a572d0ee4b29cbfb7b931d5a42c6d9050/psutil-5.9.8.tar.gz"
    sha256 "6be126e3225486dff286a8fb9a06246a5253f4c7c53b475ea5f5ac934e64194c"
  end

  resource "httpx" do
    url "https://files.pythonhosted.org/packages/5c/2d/3da5bdf4408b8b2800061c339f240c1802f2e82d55e50bd73c00832d67b1/httpx-0.27.0.tar.gz"
    sha256 "a0cb88a46f32dc874e04ee956e4c2764aba2aa228f650b06788ba6bda2962ab5"
  end

  def install
    virtualenv_install_with_resources
  end

  test do
    system "#{bin}/opencode-orchestrator", "--version"
    system "#{bin}/opencode-orchestrator", "--help"
  end
end
